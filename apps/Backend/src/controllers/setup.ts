import { Request, Response } from "express";
import { prisma } from "../config/database";
import { generateApiKey } from "../utils/generateApiKey";
import { AuthRequest } from "../middleware/jwtAuth";

const PROJECT_STATUSES = ["ACTIVE", "DEGRADED", "INACTIVE"] as const;
const PROJECT_REGIONS = ["US-EAST-1", "US-WEST-2", "EU-WEST-1", "AP-SOUTH-1"] as const;
const SERVICE_STATUSES = ["ACTIVE", "DEGRADED", "INACTIVE"] as const;

async function resolveEffectiveUserId(req: AuthRequest): Promise<string | null> {
  const userIdFromToken = req.userId;
  const userEmailFromToken = req.userEmail;

  if (userIdFromToken) {
    const userById = await prisma.user.findUnique({
      where: { id: userIdFromToken },
      select: { id: true },
    });

    if (userById) {
      return userById.id;
    }
  }

  if (userEmailFromToken) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: userEmailFromToken },
      select: { id: true },
    });

    if (userByEmail) {
      return userByEmail.id;
    }
  }

  return null;
}

export async function createProject(req: AuthRequest, res: Response) {
  try {
    const { name, description, region, status } = req.body;
    const userIdFromToken = req.userId;
    const userEmailFromToken = req.userEmail;

    if (!userIdFromToken && !userEmailFromToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let effectiveUserId = userIdFromToken;

    if (effectiveUserId) {
      const userExists = await prisma.user.findUnique({
        where: { id: effectiveUserId },
        select: { id: true },
      });

      if (!userExists) {
        effectiveUserId = undefined;
      }
    }

    if (!effectiveUserId && userEmailFromToken) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: userEmailFromToken },
        select: { id: true },
      });

      if (userByEmail) {
        effectiveUserId = userByEmail.id;
      }
    }

    if (!effectiveUserId) {
      return res.status(401).json({ error: "Session is invalid. Please log in again." });
    }

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const normalizedStatus = String(status || "ACTIVE").toUpperCase();
    const normalizedRegion = String(region || "US-EAST-1").toUpperCase();
    const normalizedDescription = typeof description === "string" ? description.trim() : null;

    if (!PROJECT_STATUSES.includes(normalizedStatus as (typeof PROJECT_STATUSES)[number])) {
      return res.status(400).json({ error: "Invalid project status" });
    }

    if (!PROJECT_REGIONS.includes(normalizedRegion as (typeof PROJECT_REGIONS)[number])) {
      return res.status(400).json({ error: "Invalid project region" });
    }

    const existing = await prisma.project.findFirst({
      where: { 
        name,
        userId: effectiveUserId,
      },
    });

    if (existing) {
      return res.status(400).json({ 
        error: "You already have a project with this name" 
      });
    }

    const apiKey = generateApiKey();
    const projectId = crypto.randomUUID();

    // Create project and its primary API key in a transaction
    const [project, primaryApiKey] = await prisma.$transaction([
      prisma.project.create({
        data: { 
          name,
          id: projectId,
          description: normalizedDescription,
          region: normalizedRegion,
          status: normalizedStatus,
          userId: effectiveUserId,
        } as any,
      }),
      prisma.apiKey.create({
        data: {
          key: apiKey,
          projectId: projectId,
          isActive: true,
        },
      }),
    ]);

    return res.json({
      ...project,
      apiKey: primaryApiKey.key,
      message: "Project created with primary API key",
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ error: "Failed to create project" });
  }
}
export async function createApiKey(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Ensure user owns the project
    if (project.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const key = generateApiKey();

    const [, apiKey] = await prisma.$transaction([
      prisma.apiKey.updateMany({
        where: {
          projectId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      }),
      prisma.apiKey.create({
        data: {
          key,
          projectId,
          isActive: true,
        },
      }),
    ]);

    return res.json({
      message: "API key created successfully",
      apiKey: apiKey.key,
    });
  } catch (error) {
    console.error("Create API key error:", error);
    return res.status(500).json({ error: "Failed to create API key" });
  }
}

export async function createService(req: AuthRequest, res: Response) {
  try {
    const { projectId, serviceName, status, uptime } = req.body;
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!projectId || !serviceName) {
      return res.status(400).json({ error: "projectId and serviceName are required" });
    } 

    const normalizedStatus = String(status || "ACTIVE").toUpperCase();
    const uptimeValue = uptime === undefined ? 100 : Number(uptime);

    if (!SERVICE_STATUSES.includes(normalizedStatus as (typeof SERVICE_STATUSES)[number])) {
      return res.status(400).json({ error: "Invalid service status" });
    }

    if (!Number.isFinite(uptimeValue) || uptimeValue < 0 || uptimeValue > 100) {
      return res.status(400).json({ error: "Service uptime must be between 0 and 100" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    
    if (project.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const existing = await prisma.service.findFirst({
      where: {
        projectId,
        name: serviceName,
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Service already exists for this project" });
    }

    const service = await prisma.service.create({
      data: {
        id: crypto.randomUUID(),
        name: serviceName,
        status: normalizedStatus,
        uptime: uptimeValue,
        projectId,
      } as any,
    });

    return res.json({
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);
    return res.status(500).json({ error: "Failed to create service" });
  }
}