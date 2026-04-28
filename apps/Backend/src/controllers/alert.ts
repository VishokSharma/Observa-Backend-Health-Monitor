import { Response } from "express";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/jwtAuth";

const ALERT_OPERATORS = [">", "<"] as const;
const SYSTEM_METRIC_FIELDS = ["avgCpu", "avgMemoryMb"] as const;
const REQUEST_METRIC_FIELDS = [
  "errorRate",
  "avgLatencyMs",
] as const;

function validateThresholdForMetric(metricField: string, threshold: number): string | null {
  if (!Number.isFinite(threshold)) {
    return "Invalid threshold";
  }

  if (metricField === "avgCpu" || metricField === "errorRate") {
    if (threshold < 0.1) {
      return "threshold must be >= 0.1 for percent metrics";
    }

    if (threshold > 100) {
      return "threshold must be <= 100 for percent metrics";
    }

    return null;
  }

  if (threshold < 0) {
    return "threshold must be non-negative";
  }

  return null;
}

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

async function validateProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) {
    return false;
  }

  return project.userId === userId;
}

export async function getAlertRules(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectId = String(req.query.projectId || "");
    const serviceName = String(req.query.serviceName || "");

    if (!projectId || !serviceName) {
      return res.status(400).json({ error: "projectId and serviceName are required" });
    }

    const hasAccess = await validateProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const rules = await prisma.alertRule.findMany({
      where: {
        projectId,
        serviceName,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ rules });
  } catch (error) {
    console.error("Get alert rules error:", error);
    return res.status(500).json({ error: "Failed to fetch alert rules" });
  }
}

export async function createAlertRule(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      projectId,
      serviceName,
      metricType,
      metricField,
      operator,
      threshold,
      windowSec,
      endpoint,
      isActive,
    } = req.body;

    if (
      !projectId ||
      !serviceName ||
      !metricType ||
      !metricField ||
      !operator ||
      threshold === undefined ||
      windowSec === undefined
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!ALERT_OPERATORS.includes(operator)) {
      return res.status(400).json({ error: "Invalid operator" });
    }

    const normalizedMetricType = String(metricType || "").toLowerCase();
    const normalizedEndpoint = typeof endpoint === "string" && endpoint.trim() !== "" ? endpoint.trim() : null;
    if (
      (normalizedMetricType === "system" && !SYSTEM_METRIC_FIELDS.includes(metricField)) ||
      (normalizedMetricType === "request" && !REQUEST_METRIC_FIELDS.includes(metricField))
    ) {
      return res.status(400).json({ error: "Invalid metricField for metricType" });
    }

    const numericThreshold = Number(threshold);
    const numericWindowSec = Number(windowSec);

    if (!Number.isFinite(numericThreshold)) {
      return res.status(400).json({ error: "Invalid threshold" });
    }

    const thresholdValidation = validateThresholdForMetric(metricField, numericThreshold);
    if (thresholdValidation) {
      return res.status(400).json({ error: thresholdValidation });
    }

    if (!Number.isInteger(numericWindowSec) || numericWindowSec <= 0) {
      return res.status(400).json({ error: "windowSec must be a positive integer" });
    }

    const hasAccess = await validateProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const projectWebhook = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ...( { slackWebhookUrl: true } as Record<string, boolean> ),
      } as any,
    });

    if (!(projectWebhook as any)?.slackWebhookUrl) {
      return res.status(400).json({ error: "Set project slack webhook first" });
    }

    const existingRule = await prisma.alertRule.findFirst({
      where: {
        projectId,
        serviceName,
        metricType: normalizedMetricType,
        metricField,
        operator,
        endpoint: normalizedEndpoint,
      },
    });

    const alertRule = existingRule
      ? await prisma.alertRule.update({
          where: { id: existingRule.id },
          data: {
            threshold: numericThreshold,
            windowSec: numericWindowSec,
            isActive: isActive === undefined ? true : Boolean(isActive),
            ...( { triggered: false } as Record<string, boolean> ),
          } as any,
        })
      : await prisma.alertRule.create({
          data: {
            projectId,
            serviceName,
            metricType: normalizedMetricType,
            metricField,
            operator,
            threshold: numericThreshold,
            windowSec: numericWindowSec,
            endpoint: normalizedEndpoint,
            isActive: isActive === undefined ? true : Boolean(isActive),
          } as any,
        });

    return res.status(201).json({
      message: "Alert rule created successfully",
      alertRule,
    });
  } catch (error) {
    console.error("Create alert rule error:", error);
    return res.status(500).json({ error: "Failed to create alert rule" });
  }
}

export async function updateAlertRule(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const alertRuleId = req.params.id;
    if (!alertRuleId) {
      return res.status(400).json({ error: "Alert rule id is required" });
    }

    const existingRule = await prisma.alertRule.findUnique({
      where: { id: alertRuleId },
    });

    if (!existingRule) {
      return res.status(404).json({ error: "Alert rule not found" });
    }

    const hasAccess = await validateProjectAccess(existingRule.projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { threshold, windowSec } = req.body;

    if (threshold !== undefined && !Number.isFinite(Number(threshold))) {
      return res.status(400).json({ error: "Invalid threshold" });
    }

    if (threshold !== undefined) {
      const thresholdValidation = validateThresholdForMetric(existingRule.metricField, Number(threshold));
      if (thresholdValidation) {
        return res.status(400).json({ error: thresholdValidation });
      }
    }

    if (
      windowSec !== undefined &&
      (!Number.isInteger(Number(windowSec)) || Number(windowSec) <= 0)
    ) {
      return res.status(400).json({ error: "windowSec must be a positive integer" });
    }

    const updateData: any = {};

    if (threshold !== undefined) {
      updateData.threshold = Number(threshold);
    }
    if (windowSec !== undefined) {
      updateData.windowSec = Number(windowSec);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Only threshold or windowSec can be updated" });
    }

    const alertRule = await prisma.alertRule.update({
      where: { id: alertRuleId },
      data: updateData,
    });

    return res.json({
      message: "Alert rule updated successfully",
      alertRule,
    });
  } catch (error) {
    console.error("Update alert rule error:", error);
    return res.status(500).json({ error: "Failed to update alert rule" });
  }
}
