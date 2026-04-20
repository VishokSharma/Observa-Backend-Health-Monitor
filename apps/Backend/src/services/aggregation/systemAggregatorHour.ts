import {prisma} from "../../config/database";
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;

export async function runSystemHourAggregation() {
  const now = Date.now();

 
  const currentHourStart =
    Math.floor(now / ONE_HOUR) * ONE_HOUR;


  const bucketStart = currentHourStart - ONE_HOUR;
  const bucketEnd = currentHourStart;

  //console.log("System hour aggregation for:", new Date(bucketStart));
  //console.log("Bucket Start:", new Date(bucketStart));
  //console.log("Bucket End:", new Date(bucketEnd));


  const minuteMetrics =
    await prisma.systemMetricAggregate.findMany({
      where: {
        minuteBucket: {
          gte: BigInt(bucketStart),
          lt: BigInt(bucketEnd),
        },
      },
    });

  if (minuteMetrics.length === 0) {
   // console.log("No system minute data found for this hour.");
    return;
  }

  const grouped = new Map<string, typeof minuteMetrics>();

  for (const metric of minuteMetrics) {
    const key = `${metric.projectId}_${metric.serviceName}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

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

    await prisma.systemMetricAggregateHour.upsert({
      where: {
        projectId_serviceName_hourBucket: {
          projectId,
          serviceName,
          hourBucket: BigInt(bucketStart),
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
        hourBucket: BigInt(bucketStart),
        avgCpu,
        maxCpu,
        avgMemoryMb,
        maxMemoryMb,
      },
    });
  }

 // console.log("System hour aggregation complete.");
}