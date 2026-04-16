import { prisma } from "../../config/database";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

export async function runRequestDayAggregation() {
  const now = Date.now();

  const currentDayStart =
    Math.floor(now / ONE_DAY) * ONE_DAY;

  const bucketStart = currentDayStart - ONE_DAY;
  const bucketEnd = currentDayStart;

  //console.log("Day aggregation for:", new Date(bucketStart));

  const hourMetrics =
    await prisma.requestMetricAggregateHour.findMany({
      where: {
        hourBucket: {
          gte: BigInt(bucketStart),
          lt: BigInt(bucketEnd),
        },
      },
    });

  if (hourMetrics.length === 0) {
    console.log("No hour data for this day.");
    return;
  }

  const grouped = new Map<string, typeof hourMetrics>();

  for (const metric of hourMetrics) {
    const key = `${metric.projectId}_${metric.serviceName}_${metric.route}_${metric.method}`;

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(metric);
  }

  for (const metrics of grouped.values()) {
    const { projectId, serviceName, route, method } = metrics[0];

    const totalRequests =
      metrics.reduce((sum, m) => sum + m.totalRequests, 0);

    const successCount =
      metrics.reduce((sum, m) => sum + m.successCount, 0);

    const clientErrorCount =
      metrics.reduce((sum, m) => sum + m.clientErrorCount, 0);

    const serverErrorCount =
      metrics.reduce((sum, m) => sum + m.serverErrorCount, 0);

    // Weighted average again
    const weightedSum =
      metrics.reduce(
        (sum, m) =>
          sum + m.totalRequests * m.avgResponseTime,
        0
      );

    const avgResponseTime =
      totalRequests > 0
        ? weightedSum / totalRequests
        : 0;

    const maxResponseTime =
      Math.max(...metrics.map(m => m.maxResponseTime));

    const p95ResponseTime =
      Math.max(...metrics.map(m => m.p95ResponseTime));

    await prisma.requestMetricAggregateDay.upsert({
      where: {
        projectId_serviceName_route_method_dayBucket: {
          projectId,
          serviceName,
          route,
          method,
          dayBucket: BigInt(bucketStart),
        },
      },
      update: {
        totalRequests,
        successCount,
        clientErrorCount,
        serverErrorCount,
        avgResponseTime,
        maxResponseTime,
        p95ResponseTime,
      },
      create: {
        projectId,
        serviceName,
        route,
        method,
        dayBucket: BigInt(bucketStart),
        totalRequests,
        successCount,
        clientErrorCount,
        serverErrorCount,
        avgResponseTime,
        maxResponseTime,
        p95ResponseTime,
      },
    });
  }

  //console.log("Request day aggregation complete.");
}