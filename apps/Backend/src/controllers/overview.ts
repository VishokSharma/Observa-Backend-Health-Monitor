import { Request, Response } from "express";
import { prisma } from "../config/database";

export async function getServiceOverview(req: Request, res: Response) {
  try {
    const { projectId, serviceName } = req.query;

    if (!projectId || !serviceName) {
      return res.status(400).json({
        error: "projectId and serviceName are required",
      });
    }

    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;

    const last24hStart = now - ONE_DAY;
    const last1hStart = now - ONE_HOUR;
    const requestRows =
      await prisma.requestMetricAggregateHour.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          hourBucket: {
            gte: BigInt(last24hStart),
            lte: BigInt(now),
          },
        },
      });

    const systemRows =
      await prisma.systemMetricAggregateHour.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          hourBucket: {
            gte: BigInt(last1hStart),
            lte: BigInt(now),
          },
        },
      });

  
    const totalRequests = requestRows.reduce(
      (sum: number, row) => sum + row.totalRequests,
      0
    );

    const totalErrors = requestRows.reduce(
      (sum: number, row) =>
        sum + row.clientErrorCount + row.serverErrorCount,
      0
    );

    const errorRate =
      totalRequests > 0
        ? (totalErrors / totalRequests) * 100
        : 0;

    const weightedLatencySum = requestRows.reduce(
      (sum: number, row) =>
        sum + row.totalRequests * row.avgResponseTime,
      0
    );

    const avgResponseTime =
      totalRequests > 0
        ? weightedLatencySum / totalRequests
        : 0;

    const p95ResponseTime = Math.max(
      ...requestRows.map((r: any) => r.p95ResponseTime),
      0
    );



    const avgCpu =
      systemRows.length > 0
        ? systemRows.reduce((sum: number, r) => sum + r.avgCpu, 0) /
          systemRows.length
        : 0;

    const avgMemory =
      systemRows.length > 0
        ? systemRows.reduce(
            (sum: number, r) => sum + r.avgMemoryMb,
            0
          ) / systemRows.length
        : 0;


    let status = "healthy";

    if (errorRate > 10) {
      status = "critical";
    } else if (errorRate > 5 || avgResponseTime > 700 || avgCpu > 85) {
      status = "degraded";
    }

    return res.json({
      serviceName,
      timeWindow: "last_24_hours",

      totalRequests,
      errorRate: Number(errorRate.toFixed(2)),
      avgResponseTime: Number(avgResponseTime.toFixed(2)),
      p95ResponseTime,

      avgCpuLastHour: Number(avgCpu.toFixed(2)),
      avgMemoryLastHour: Number(avgMemory.toFixed(2)),

      status,
    });
  } catch (error) {
    console.error("Overview error:", error);
    return res.status(500).json({
      error: "Failed to fetch service overview",
    });
  }
}