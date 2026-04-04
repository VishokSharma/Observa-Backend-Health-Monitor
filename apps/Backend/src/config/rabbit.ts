import amqp from "amqplib";

let channel: amqp.Channel;

const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";

export const METRICS_EXCHANGE = "metrics_exchange";
export const METRICS_QUEUE = "metrics_queue";
export const METRIC_ROUTING_KEY = "metric";

export async function connectRabbit() {
  const connection = await amqp.connect(rabbitmqUrl);

  channel = await connection.createChannel();

  await channel.assertExchange(METRICS_EXCHANGE, "direct", {
    durable: true,
  });

  await channel.assertQueue(METRICS_QUEUE, {
    durable: true,
  });

  await channel.bindQueue(METRICS_QUEUE, METRICS_EXCHANGE, METRIC_ROUTING_KEY);

  console.log("RabbitMQ connected");
}

export function getChannel() {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }
  return channel;
}

export function publishMetric(payload: unknown) {
  const activeChannel = getChannel();
  return activeChannel.publish(
    METRICS_EXCHANGE,
    METRIC_ROUTING_KEY,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
}