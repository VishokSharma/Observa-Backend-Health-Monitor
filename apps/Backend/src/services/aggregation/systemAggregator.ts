import { prisma } from "../../config/database";
const ONE_MINUTE = 60 * 1000;

export async function runSystemAggregation() {
  const now = Date.now();

  const currentMinuteStart =
    Math.floor(now / ONE_MINUTE) * ONE_MINUTE;

  const bucketStart = currentMinuteStart - ONE_MINUTE;
  const bucketEnd = currentMinuteStart;

  //console.log("System aggregation for:", new Date(bucketStart));

  const rawMetrics = await prisma.systemMetric.findMany({
    where: {
      timestamp: {
        gte: BigInt(bucketStart),
        lt: BigInt(bucketEnd),
      },
    },
  });

  if (rawMetrics.length === 0) return;

  const grouped = new Map<string, typeof rawMetrics>();

  for (const metric of rawMetrics) {
    const key = `${metric.projectId}_${metric.serviceName}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(metric);
  }

  for (const metrics of grouped.values()) {
    const { projectId, serviceName } = metrics[0];

    const cpuValues = metrics.map(m => m.cpuUsagePercent);
    const memoryValues = metrics.map(m => m.memoryUsageMb);

    const avgCpu =
      cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;

    const maxCpu = Math.max(...cpuValues);

    const avgMemory =
      memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;

    const maxMemory = Math.max(...memoryValues);

    await prisma.systemMetricAggregate.upsert({
      where: {
        projectId_serviceName_minuteBucket: {
          projectId,
          serviceName,
          minuteBucket: BigInt(bucketStart),
        },
      },
      update: {
        avgCpu,
        maxCpu,
        avgMemoryMb: avgMemory,
        maxMemoryMb: maxMemory,
      },
      create: {
        projectId,
        serviceName,
        minuteBucket: BigInt(bucketStart),
        avgCpu,
        maxCpu,
        avgMemoryMb: avgMemory,
        maxMemoryMb: maxMemory,
      },
    });
  }

  console.log("System aggregation complete.");
}