import amqp from "amqplib";
import { prisma } from "../config/database";
import {
  METRICS_EXCHANGE,
  METRICS_QUEUE,
  METRIC_ROUTING_KEY,
} from "../config/rabbit";
import { MetricType, RequestMetric, SystemMetric } from "../types/metric.types";

type QueuedMetric = {
  projectId: string;
  metric: RequestMetric | SystemMetric;
};

const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";

export async function startMetricWorker() {
  const connection = await amqp.connect(rabbitmqUrl);
  const channel = await connection.createChannel();

  await channel.assertExchange(METRICS_EXCHANGE, "direct", {
    durable: true,
  });

  await channel.assertQueue(METRICS_QUEUE, {
    durable: true,
  });

  await channel.bindQueue(METRICS_QUEUE, METRICS_EXCHANGE, METRIC_ROUTING_KEY);

  channel.prefetch(10);

  channel.consume(
    METRICS_QUEUE,
    async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString()) as QueuedMetric;

        if (!payload?.projectId || !payload?.metric?.serviceName) {
          channel.nack(msg, false, false);
          return;
        }

        const { projectId, metric } = payload;

        await prisma.service.upsert({
          where: {
            projectId_name: {
              projectId,
              name: metric.serviceName,
            },
          },
          update: {},
          create: {
            id: crypto.randomUUID(),
            name: metric.serviceName,
            projectId,
          },
        });

        if (metric.type === MetricType.REQUEST) {
          await prisma.requestMetric.create({
            data: {
              projectId,
              serviceName: metric.serviceName,
              timestamp: metric.timestamp,
              method: metric.method,
              route: metric.route,
              statusCode: metric.statusCode,
              latencyMs: metric.latencyMs,
              isError: metric.isError,
            },
          });
        } else if (metric.type === MetricType.SYSTEM) {
          await prisma.systemMetric.create({
            data: {
              projectId,
              serviceName: metric.serviceName,
              timestamp: metric.timestamp,
              cpuUsagePercent: metric.cpuUsagePercent,
              memoryUsageMb: metric.memoryUsageMb,
            },
          });
        } else {
          channel.nack(msg, false, false);
          return;
        }
        
        channel.ack(msg);
        console.log("Worker processed metric:", {
          projectId,
          type: metric.type,
          service: metric.serviceName
        });
      } catch (error) {
        console.error("Worker failed to persist metric:", error);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  console.log("Worker running...");
}