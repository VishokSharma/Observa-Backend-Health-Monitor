import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || "3001";
const BASE_URL = `http://localhost:${PORT}`;

const INTERVAL_MS = Number(process.env.TRAFFIC_INTERVAL_MS || "700");

type TrafficEndpoint = {
  path: string;
  weight: number;
  method: "POST";
  bodyFactory: () => unknown;
};

const endpoints: TrafficEndpoint[] = [
  {
    path: "/auth/login",
    method: "POST",
    weight: 35,
    bodyFactory: () => ({
      email: `user${Math.floor(Math.random() * 50)}@example.com`,
      password: "password123",
    }),
  },
  {
    path: "/orders/create",
    method: "POST",
    weight: 30,
    bodyFactory: () => ({
      customerId: `cust_${Math.floor(Math.random() * 1000)}`,
      amount: Number((Math.random() * 800 + 20).toFixed(2)),
      currency: "USD",
      items: [
        { sku: "SKU-1", qty: 1 },
        { sku: "SKU-2", qty: Math.ceil(Math.random() * 3) },
      ],
    }),
  },
  {
    path: "/payments/charge",
    method: "POST",
    weight: 20,
    bodyFactory: () => ({
      orderId: `ord_${Date.now()}`,
      amount: Number((Math.random() * 500 + 10).toFixed(2)),
      source: "card",
    }),
  },
  {
    path: "/notifications/send",
    method: "POST",
    weight: 15,
    bodyFactory: () => ({
      channel: "email",
      to: `customer${Math.floor(Math.random() * 200)}@example.com`,
      message: "Your event was processed",
    }),
  },
];

async function makeRequest(endpoint: TrafficEndpoint) {
  try {
    const start = Date.now();
    const response = await fetch(`${BASE_URL}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(endpoint.bodyFactory()),
    });
    const duration = Date.now() - start;

    console.log(
      `[${new Date().toISOString()}] ${endpoint.method} ${endpoint.path} → ${response.status} (${duration}ms)`
    );
  } catch (error) {
    console.error(`Error calling ${endpoint.path}:`, error);
  }
}

function getRandomEndpoint(): TrafficEndpoint {
  const random = Math.random() * 100;
  let cumulative = 0;

  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      return endpoint;
    }
  }

  return endpoints[0];
}

async function generateTraffic() {
  const endpoint = getRandomEndpoint();
  await makeRequest(endpoint);
}

function startTrafficGenerator(intervalMs: number = INTERVAL_MS) {
  console.log(`🚦 Traffic generator started`);
  console.log(`📊 Generating requests every ${intervalMs}ms`);
  console.log(`🎯 Target: ${BASE_URL}`);
  console.log(`📈 Endpoints: ${endpoints.map(e => `${e.method} ${e.path} (${e.weight}%)`).join(", ")}`);
  console.log("---");

  // Generate traffic at specified interval
  setInterval(() => {
    generateTraffic();
  }, intervalMs);

  // Also generate initial request immediately
  generateTraffic();
}

startTrafficGenerator(INTERVAL_MS);
