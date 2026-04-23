import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database";
import { generateToken } from "../middleware/jwtAuth";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_SCOPE = "openid email profile";
const FRONTEND_AUTH_REDIRECT_URL = process.env.FRONTEND_AUTH_REDIRECT_URL || "http://localhost:5173/";

type GoogleMode = "signin" | "signup";

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function getModeFromQuery(mode: unknown): GoogleMode {
  return mode === "signup" ? "signup" : "signin";
}

function buildFrontendRedirect(params: Record<string, string>) {
  const redirectUrl = new URL(FRONTEND_AUTH_REDIRECT_URL);

  Object.entries(params).forEach(([key, value]) => {
    redirectUrl.searchParams.set(key, value);
  });

  return redirectUrl.toString();
}

async function exchangeCodeForGoogleAccessToken(code: string, config: { clientId: string; clientSecret: string; redirectUri: string; }) {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange Google auth code");
  }

  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Missing Google access token");
  }

  return tokenData.access_token;
}

async function getGoogleUserProfile(accessToken: string) {
  const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  return await profileResponse.json() as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
}

export async function signup(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Email, password, and name are required",
      });
    }

    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User with this email already exists",
      });
    }

  
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    
    const token = generateToken(user.id, user.email);

    return res.status(201).json({
      message: "User created successfully",
      user,
      token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Failed to create user" });
  }
}

export async function signin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

  
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    
    const token = generateToken(user.id, user.email);

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({ error: "Failed to sign in" });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
}

export async function startGoogleAuth(req: Request, res: Response) {
  const config = getGoogleConfig();
  if (!config) {
    return res.status(500).json({
      error: "Google OAuth is not configured",
    });
  }

  const mode = getModeFromQuery(req.query.mode);
  const state = Buffer.from(
    JSON.stringify({
      mode,
      nonce: Date.now(),
    })
  ).toString("base64url");

  const authUrl = new URL(GOOGLE_AUTH_BASE_URL);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return res.redirect(authUrl.toString());
}

export async function googleAuthCallback(req: Request, res: Response) {
  try {
    const config = getGoogleConfig();
    if (!config) {
      return res.redirect(buildFrontendRedirect({
        authError: "Google OAuth is not configured",
      }));
    }

    const error = typeof req.query.error === "string" ? req.query.error : "";
    if (error) {
      return res.redirect(buildFrontendRedirect({
        authError: "Google authentication was cancelled",
      }));
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateRaw = typeof req.query.state === "string" ? req.query.state : "";

    if (!code || !stateRaw) {
      return res.redirect(buildFrontendRedirect({
        authError: "Missing Google OAuth callback parameters",
      }));
    }

    let mode: GoogleMode = "signin";
    try {
      const parsedState = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as {
        mode?: GoogleMode;
      };
      mode = parsedState.mode === "signup" ? "signup" : "signin";
    } catch {
      return res.redirect(buildFrontendRedirect({
        authError: "Invalid OAuth state",
      }));
    }

    const accessToken = await exchangeCodeForGoogleAccessToken(code, config);
    const profile = await getGoogleUserProfile(accessToken);

    if (!profile.email || !profile.email_verified || !profile.sub) {
      return res.redirect(buildFrontendRedirect({
        authError: "Google account email is not verified",
      }));
    }

    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user && mode === "signin") {
      return res.redirect(buildFrontendRedirect({
        authError: "No account found. Please sign up first.",
      }));
    }

    if (!user) {
      const fallbackPassword = await bcrypt.hash(
        `google-oauth-${profile.sub}-${JWT_SECRET}`,
        SALT_ROUNDS
      );

      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split("@")[0],
          password: fallbackPassword,
        },
      });
    }

    const token = generateToken(user.id, user.email);
    const userPayload = JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return res.redirect(buildFrontendRedirect({
      token,
      user: Buffer.from(userPayload, "utf8").toString("base64url"),
    }));
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return res.redirect(buildFrontendRedirect({
      authError: "Google authentication failed",
    }));
  }
}
