import { prisma } from "../../config/database";
const ONE_MINUTE = 60 * 1000;

function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(0.95 * sorted.length);
  return sorted[index];
}

export async function runRequestAggregation() {
  const now = Date.now();

  const currentMinuteStart =
    Math.floor(now / ONE_MINUTE) * ONE_MINUTE;

  const bucketStart = currentMinuteStart - ONE_MINUTE;
  const bucketEnd = currentMinuteStart;

// AFTER
// removed — or gate behind a DEBUG flag if you want it locally:
if (process.env.DEBUG_AGGREGATION) {
  console.log("Request aggregation bucket:", new Date(bucketStart), "→", new Date(bucketEnd));
}

  const rawMetrics = await prisma.requestMetric.findMany({
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
    const key = `${metric.projectId}_${metric.serviceName}_${metric.route}_${metric.method}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(metric);
  }

  for (const metrics of grouped.values()) {
    const { projectId, serviceName, route, method } = metrics[0];

    const totalRequests = metrics.length;


 let successCount = 0;
 let clientErrorCount = 0;
 let serverErrorCount = 0;
 let latencySum = 0;
 let maxResponseTime = 0;
 const latencies: number[] = [];

 for (const m of metrics) {
   if (m.statusCode >= 200 && m.statusCode < 300) {
     successCount++;
   } else if (m.statusCode >= 400 && m.statusCode < 500) {
     clientErrorCount++;
   } else if (m.statusCode >= 500) {
     serverErrorCount++;
   }

   latencies.push(m.latencyMs);
   latencySum += m.latencyMs;

   if (m.latencyMs > maxResponseTime) {
     maxResponseTime = m.latencyMs;
   }
 }

const avgResponseTime = latencySum / latencies.length;
const p95ResponseTime = calculateP95(latencies);


    await prisma.requestMetricAggregate.upsert({
      where: {
        projectId_serviceName_route_method_minuteBucket: {
          projectId,
          serviceName,
          route,
          method,
          minuteBucket: BigInt(bucketStart),
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
        minuteBucket: BigInt(bucketStart),
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

  console.log("Request aggregation complete.");
}
