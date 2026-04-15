import {prisma} from "../../config/database";
const ONE_MINUTE = 60*1000;
const ONE_HOUR = 60*ONE_MINUTE;

export async function runRequestHourAggregation() {
  const now = Date.now();
  const currentHourStart = Math.floor(now / ONE_HOUR) * ONE_HOUR;
    const bucketStart = currentHourStart - ONE_HOUR;
    const bucketEnd = currentHourStart;

 // console.log("Hour aggregation for:", new Date(bucketStart));
  //console.log("Bucket Start:", new Date(bucketStart));
 // console.log("Bucket End:", new Date(bucketEnd));
  const minuteMetrics = await prisma.requestMetricAggregate.findMany({
    where: {
      minuteBucket: {
        gte: BigInt(bucketStart),
        lt: BigInt(bucketEnd),
      },
    },
  });   
  if(minuteMetrics.length === 0) {
    //console.log("No minute metrics found for this hour.");
    return;
  }
const grouped = new Map<string, typeof minuteMetrics>();
for(const metric of minuteMetrics) {
    const key = `${metric.projectId}_${metric.serviceName}_${metric.route}_${metric.method}`;
    if(!grouped.has(key)) {
        grouped.set(key, []);
    }
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

    // Approximation (not exact statistical p95)
    const p95ResponseTime =
      Math.max(...metrics.map(m => m.p95ResponseTime));

    await prisma.requestMetricAggregateHour.upsert({
      where: {
        projectId_serviceName_route_method_hourBucket: {
          projectId,
          serviceName,
          route,
          method,
          hourBucket: BigInt(bucketStart),
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
        hourBucket: BigInt(bucketStart),
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

  //console.log("Hour request aggregation complete.");

}