import express, { Request, Response, NextFunction } from "express";
import { monitorMiddleware, startSystemMetrics } from "backend-monitoring-sdk";
import dotenv from "dotenv";


dotenv.config();

const PORT = process.env.PORT || "3001";
const MONITORING_URL = process.env.MONITORING_URL || "https://infrawatch.mooo.com/api/collect";
const MONITORING_API_KEY = process.env.MONITORING_API_KEY || "153e5360de4cc00f01c9f5756005ed7936dcc606a8bf45219680a204ac6d9d30";
const SERVICE_NAME = process.env.SERVICE_NAME || "auth-service-test";

if (!MONITORING_API_KEY) {
  console.error("Error: MONITORING_API_KEY is required");
  process.exit(1);
}

const app = express();
app.use(express.json());

function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function shouldFail(percentage: number): boolean {
  return Math.random() * 100 < percentage;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

startSystemMetrics(
  {
    serviceName: SERVICE_NAME,
    collectorUrl: MONITORING_URL,
    apiKey: MONITORING_API_KEY,
  },
  5000
);


const middleware = monitorMiddleware({
  serviceName: SERVICE_NAME,
  collectorUrl: MONITORING_URL,
  apiKey: MONITORING_API_KEY,
});
app.use((req: Request, res: Response, next: NextFunction) => middleware(req, res, next));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: SERVICE_NAME });
});

app.post("/auth/login", async (req: Request, res: Response) => {
  await sleep(randomBetween(30, 120));

  if (shouldFail(4)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (shouldFail(2)) {
    return res.status(500).json({ error: "Auth provider unavailable" });
  }

  return res.status(200).json({
    userId: `usr_${Date.now()}`,
    email: req.body?.email || "demo@example.com",
    token: "mock-jwt-token",
  });
});

app.post("/orders/create", async (_req: Request, res: Response) => {
  await sleep(randomBetween(80, 220));

  if (shouldFail(10)) {
    return res.status(422).json({ error: "Validation failed for order payload" });
  }

  if (shouldFail(5)) {
    return res.status(500).json({ error: "Order persistence failed" });
  }

  return res.status(201).json({
    orderId: `ord_${Date.now()}`,
    status: "created",
  });
});

app.post("/payments/charge", async (_req: Request, res: Response) => {
  await sleep(randomBetween(120, 400));

  if (shouldFail(15)) {
    return res.status(402).json({ error: "Card declined" });
  }

  if (shouldFail(8)) {
    return res.status(500).json({ error: "Payment gateway timeout" });
  }

  return res.status(200).json({
    paymentId: `pay_${Date.now()}`,
    status: "captured",
  });
});

app.post("/notifications/send", async (_req: Request, res: Response) => {
  await sleep(randomBetween(40, 180));

  if (shouldFail(20)) {
    return res.status(429).json({ error: "Notification rate limit hit" });
  }

  if (shouldFail(6)) {
    return res.status(500).json({ error: "Notification broker unavailable" });
  }

  return res.status(202).json({
    notificationId: `ntf_${Date.now()}`,
    status: "queued",
  });
});


app.get("/ping", (req: Request, res: Response) => {
  res.json({ message: "pong" });
});

app.get("/slow", async (req: Request, res: Response) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  res.send("slow response");
});

app.get("/error", (req: Request, res: Response) => {
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(Number(PORT), () => {
  console.log(`✓ Test app running on port ${PORT}`);
  console.log(`✓ Service: ${SERVICE_NAME}`);
  console.log(`✓ Monitoring URL: ${MONITORING_URL}`);
  console.log(`✓ System metrics collecting every 5s`);
  console.log("✓ POST routes: /auth/login, /orders/create, /payments/charge, /notifications/send");
});
