import { Request, Response } from "express";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/jwtAuth";

const PROJECT_STATUSES = ["ACTIVE", "DEGRADED", "INACTIVE"] as const;

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

// Get all projects for authenticated user
export async function getUserProjects(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        services: true,
        _count: {
          select: {
            services: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({ projects });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ error: "Failed to fetch projects" });
  }
}

// Get single project details
export async function getProjectDetails(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      include: {
        services: true,
        apiKeys: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json({ project });
  } catch (error) {
    console.error("Get project details error:", error);
    return res.status(500).json({ error: "Failed to fetch project details" });
  }
}

// Get services for a project
export async function getProjectServices(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const services = await prisma.service.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ services });
  } catch (error) {
    console.error("Get services error:", error);
    return res.status(500).json({ error: "Failed to fetch services" });
  }
}

// Delete project
export async function deleteProject(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    await prisma.$transaction([
      prisma.apiKey.deleteMany({ where: { projectId } }),
      prisma.service.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    return res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({ error: "Failed to delete project" });
  }
}

export async function updateProjectStatus(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);
    const { projectId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const normalizedStatus = String(status || "").toUpperCase();

    if (!PROJECT_STATUSES.includes(normalizedStatus as (typeof PROJECT_STATUSES)[number])) {
      return res.status(400).json({ error: "Invalid project status" });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: { id: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { status: normalizedStatus },
    }); 

    return res.json({
      message: "Project status updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error("Update project status error:", error);
    return res.status(500).json({ error: "Failed to update project status" });
  }
}

export async function setProjectSlackWebhook(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);
    const { projectId } = req.params;
    const webhookUrl = String(req.body?.slackWebhookUrl || "").trim();

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!webhookUrl) {
      return res.status(400).json({ error: "slackWebhookUrl is required" });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: {
        id: true,
        slackWebhookUrl: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.slackWebhookUrl) {
      return res.status(409).json({ error: "Slack webhook already configured for this project" });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...( { slackWebhookUrl: webhookUrl } as Record<string, string> ),
      } as any,
    });

    return res.json({
      message: "Slack webhook configured successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error("Set project slack webhook error:", error);
    return res.status(500).json({ error: "Failed to set project slack webhook" });
  }
}
