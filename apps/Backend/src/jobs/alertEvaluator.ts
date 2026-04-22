import cron from "node-cron";
import { AlertRule } from "@prisma/client";
import { prisma } from "../config/database";

type NumericOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";
type SupportedMetricField =
  | "avgCpu"
  | "maxCpu"
  | "avgMemoryMb"
  | "maxMemoryMb"
  | "totalRequests"
  | "successCount"
  | "clientErrorCount"
  | "serverErrorCount"
  | "errorCount"
  | "errorRate"
  | "avgLatencyMs"
  | "maxLatencyMs";

function compareWithOperator(left: number, operator: string, right: number): boolean {
  const op = operator as NumericOperator;

  switch (op) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function isSupportedMetricField(metricField: string): metricField is SupportedMetricField {
  return (
    metricField === "avgCpu" ||
    metricField === "maxCpu" ||
    metricField === "avgMemoryMb" ||
    metricField === "maxMemoryMb" ||
    metricField === "totalRequests" ||
    metricField === "successCount" ||
    metricField === "clientErrorCount" ||
    metricField === "serverErrorCount" ||
    metricField === "errorCount" ||
    metricField === "errorRate" ||
    metricField === "avgLatencyMs" ||
    metricField === "maxLatencyMs"
  );
}

async function sendAlertWebhook(rule: AlertRule, message: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: rule.projectId },
    select: {
      ...( { slackWebhookUrl: true } as Record<string, boolean> ),
    } as any,
  });

  const webhookUrl = (project as any)?.slackWebhookUrl as string | undefined;

  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
      }),
    });
  } catch (error) {
    console.error("Failed to send alert webhook:", {
      alertRuleId: rule.id,
      webhookUrl,
      error,
    });
  }
}

async function computeMetricValue(rule: AlertRule, fromTs: bigint, toTs: bigint): Promise<number | null> {
  if (!isSupportedMetricField(rule.metricField)) {
    return null;
  }

  if (
    rule.metricField === "avgCpu" ||
    rule.metricField === "maxCpu" ||
    rule.metricField === "avgMemoryMb" ||
    rule.metricField === "maxMemoryMb"
  ) {
    const systemAggregate = await prisma.systemMetric.aggregate({
      where: {
        projectId: rule.projectId,
        serviceName: rule.serviceName,
        timestamp: {
          gte: fromTs,
          lt: toTs,
        },
      },
      _avg: {
        cpuUsagePercent: true,
        memoryUsageMb: true,
      },
      _max: {
        cpuUsagePercent: true,
        memoryUsageMb: true,
      },
    });

    if (rule.metricField === "avgCpu") {
      return systemAggregate._avg.cpuUsagePercent ?? null;
    }

    if (rule.metricField === "maxCpu") {
      return systemAggregate._max.cpuUsagePercent ?? null;
    }

    if (rule.metricField === "avgMemoryMb") {
      return systemAggregate._avg.memoryUsageMb ?? null;
    }

    return systemAggregate._max.memoryUsageMb ?? null;
  }

  const requestWhere = {
    projectId: rule.projectId,
    serviceName: rule.serviceName,
    ...(rule.endpoint ? { route: rule.endpoint } : {}),
    timestamp: {
      gte: fromTs,
      lt: toTs,
    },
  };

  if (rule.metricField === "avgLatencyMs" || rule.metricField === "maxLatencyMs") {
    const requestAggregate = await prisma.requestMetric.aggregate({
      where: requestWhere,
      _avg: {
        latencyMs: true,
      },
      _max: {
        latencyMs: true,
      },
    });

    if (rule.metricField === "avgLatencyMs") {
      return requestAggregate._avg.latencyMs ?? null;
    }

    return requestAggregate._max.latencyMs ?? null;
  }

  const totalAggregate = await prisma.requestMetric.aggregate({
    where: requestWhere,
    _count: {
      _all: true,
    },
  });

  const totalCount = totalAggregate._count._all;
  if (totalCount === 0) {
    return null;
  }

  if (rule.metricField === "totalRequests") {
    return totalCount;
  }

  const errorAggregate = await prisma.requestMetric.aggregate({
    where: {
      ...requestWhere,
      isError: true,
    },
    _count: {
      _all: true,
    },
  });

  const errorCount = errorAggregate._count._all;

  if (rule.metricField === "errorCount") {
    return errorCount;
  }

  if (rule.metricField === "errorRate") {
    return (errorCount / totalCount) * 100;
  }

  const successAggregate = await prisma.requestMetric.aggregate({
    where: {
      ...requestWhere,
      statusCode: {
        gte: 200,
        lt: 300,
      },
    },
    _count: {
      _all: true,
    },
  });

  if (rule.metricField === "successCount") {
    return successAggregate._count._all;
  }

  const clientErrorAggregate = await prisma.requestMetric.aggregate({
    where: {
      ...requestWhere,
      statusCode: {
        gte: 400,
        lt: 500,
      },
    },
    _count: {
      _all: true,
    },
  });

  if (rule.metricField === "clientErrorCount") {
    return clientErrorAggregate._count._all;
  }

  const serverErrorAggregate = await prisma.requestMetric.aggregate({
    where: {
      ...requestWhere,
      statusCode: {
        gte: 500,
      },
    },
    _count: {
      _all: true,
    },
  });

  if (rule.metricField === "serverErrorCount") {
    return serverErrorAggregate._count._all;
  }

  return (errorAggregate._count._all / totalCount) * 100;
}

async function evaluateRule(rule: AlertRule): Promise<void> {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const fromTs = BigInt(now - windowMs);
  const toTs = BigInt(now);

  const computedValue = await computeMetricValue(rule, fromTs, toTs);
  const shouldTrigger =
    computedValue !== null && Number.isFinite(computedValue)
      ? compareWithOperator(computedValue, rule.operator, rule.threshold)
      : false;

  if (shouldTrigger) {
    const whereCondition = {
      id: rule.id,
      ...( { triggered: false } as Record<string, boolean> ),
    };
    const dataUpdate = {
      ...( { triggered: true } as Record<string, boolean> ),
    };

    const updateResult = await prisma.alertRule.updateMany({
      where: whereCondition as any,
      data: dataUpdate as any,
    });

    if (updateResult.count > 0) {
      const message = `🚨 ${rule.metricField} threshold breached on ${rule.serviceName} (${computedValue?.toFixed(2)})`;

      console.log("Alert trigger found:", {
        alertRuleId: rule.id,
        projectId: rule.projectId,
        serviceName: rule.serviceName,
        metricType: rule.metricType,
        metricField: rule.metricField,
        operator: rule.operator,
        threshold: rule.threshold,
        windowSec: rule.windowSec,
        endpoint: rule.endpoint,
        computedValue,
      });

      await sendAlertWebhook(rule, message);
    }
    return;
  }

  if (!shouldTrigger) {
    const whereCondition = {
      id: rule.id,
      ...( { triggered: true } as Record<string, boolean> ),
    };
    const dataUpdate = {
      ...( { triggered: false } as Record<string, boolean> ),
    };

    const updateResult = await prisma.alertRule.updateMany({
      where: whereCondition as any,
      data: dataUpdate as any,
    });

    if (updateResult.count > 0) {
      const valueText = computedValue === null ? "n/a" : computedValue.toFixed(2);
      const message = `✅ Alert resolved on ${rule.serviceName} for ${rule.metricField} (${valueText})`;

      console.log("Alert resolved:", {
        alertRuleId: rule.id,
        projectId: rule.projectId,
        serviceName: rule.serviceName,
        metricType: rule.metricType,
        metricField: rule.metricField,
        operator: rule.operator,
        threshold: rule.threshold,
        windowSec: rule.windowSec,
        endpoint: rule.endpoint,
        computedValue,
      });

      await sendAlertWebhook(rule, message);
    }
  }
}

export function startAlertEvaluationJob() {
  let isRunning = false;

  cron.schedule("* * * * *", async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const rules = await prisma.alertRule.findMany({
        where: {
          isActive: true,
        },
      });

      for (const rule of rules) {
        await evaluateRule(rule);
      }
    } catch (error) {
      console.error("Alert evaluation job error:", error);
    } finally {
      isRunning = false;
    }
  });
}
