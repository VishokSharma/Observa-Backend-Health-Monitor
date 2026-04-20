import { prisma } from "../../config/database";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

export async function runSystemDayAggregation() {
  const now = Date.now();

  const currentDayStart =
    Math.floor(now / ONE_DAY) * ONE_DAY;

  const bucketStart = currentDayStart - ONE_DAY;
  const bucketEnd = currentDayStart;

  const hourMetrics =
    await prisma.systemMetricAggregateHour.findMany({
      where: {
        hourBucket: {
          gte: BigInt(bucketStart),
          lt: BigInt(bucketEnd),
        },
      },
    });

  if (hourMetrics.length === 0) return;

  const grouped = new Map<string, typeof hourMetrics>();

  for (const metric of hourMetrics) {
    const key = `${metric.projectId}_${metric.serviceName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(metric);
  }

  for (const metrics of grouped.values()) {
    const { projectId, serviceName } = metrics[0];

    const avgCpu =
      metrics.reduce((sum, m) => sum + m.avgCpu, 0) /
      metrics.length;

    const maxCpu =
      Math.max(...metrics.map(m => m.maxCpu));

    const avgMemoryMb =
      metrics.reduce((sum, m) => sum + m.avgMemoryMb, 0) /
      metrics.length;

    const maxMemoryMb =
      Math.max(...metrics.map(m => m.maxMemoryMb));

    await prisma.systemMetricAggregateDay.upsert({
      where: {
        projectId_serviceName_dayBucket: {
          projectId,
          serviceName,
          dayBucket: BigInt(bucketStart),
        },
      },
      update: {
        avgCpu,
        maxCpu,
        avgMemoryMb,
        maxMemoryMb,
      },
      create: {
        projectId,
        serviceName,
        dayBucket: BigInt(bucketStart),
        avgCpu,
        maxCpu,
        avgMemoryMb,
        maxMemoryMb,
      },
    });
  }

  console.log("System day aggregation complete.");
}