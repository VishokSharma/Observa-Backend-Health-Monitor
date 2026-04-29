import { Router } from "express";
import { signup, signin, getMe, startGoogleAuth, googleAuthCallback } from "../controllers/auth";
import { authenticateToken } from "../middleware/jwtAuth";

const authRouter: Router = Router();

authRouter.post("/signup", signup);
authRouter.post("/signin", signin);
authRouter.get("/google/start", startGoogleAuth);
authRouter.get("/google/callback", googleAuthCallback);
authRouter.get("/me", authenticateToken, getMe);

export default authRouter;
