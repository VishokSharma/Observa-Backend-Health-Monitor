# Backend Monitor

Node.js | React | TypeScript | Turborepo | PostgreSQL | RabbitMQ | Docker | Kubernetes | Jenkins

A distributed, production-ready backend monitoring system that collects request and system metrics in real-time, processes them asynchronously via message queues, aggregates them into time-series buckets, evaluates active alerting rules, and visualizes system health on a comprehensive React dashboard.

## Overview
Backend Monitor is built as a TypeScript monorepo managed with **pnpm workspaces** and **Turborepo**. The application is structured to handle high-throughput metrics ingestion from target services with minimal performance overhead.

Target services integrate the plug-and-play SDK package (`backend-monitoring-sdk`), which captures HTTP request lifecycle events (Express middleware) and periodically collects system metrics (CPU and Memory). Ingested metrics are pushed to a centralized API server, which acts as a lightweight publisher to **RabbitMQ**. Independent, asynchronous consumers process metrics from the queue and persist them to a **PostgreSQL** database via **Prisma**. Background cron jobs aggregate raw data into minute/hour/day buckets and continuously evaluate alert rules, sending notifications to channels like Slack.

## Key Features
*   **Monorepo Architecture** — Orchestrated via Turborepo and pnpm workspaces, cleanly separating apps (Backend, Dashboard, Test App) and packages (SDK, Shared Types).
*   **Asynchronous Metrics Ingestion** — Uses RabbitMQ (Direct Exchange) to offload metrics ingestion, ensuring high-throughput, non-blocking collection.
*   **Multiclass Time-Series Aggregations** — Cron-driven background aggregations (using `node-cron`) compile raw data into minute, hour, and day buckets (`RequestMetricAggregate`, `SystemMetricAggregate`, etc.) for fast historical queries.
*   **Real-time Alerting Engine** — Evaluates user-defined alert rules (CPU, memory, latency, error rate, request count) over sliding time windows and dispatches notifications via Slack webhooks.
*   **Plug-and-Play Express SDK** — Lightweight, safe-executing SDK comprising an Express middleware handler for route monitoring and a system collector for CPU/memory stats.
*   **Beautiful Dashboard Interface** — Rich, single-page React frontend built with Vite, TypeScript, and Tailwind CSS, featuring project setups, service overviews, metrics charts, and documentation access.
*   **Google OAuth & Local JWT Auth** — Complete user authorization flow via Google Sign-In or credentials, securing access to specific project data.
*   **Production-Grade Infrastructure** — Full Docker Compose configuration for local dev, raw Kubernetes (k3s) manifests for cloud hosting, and an automated Jenkins CI/CD pipeline (`Jenkinsfile`).

---

## Architecture Diagram

### Metric & Query Flow
```mermaid
graph TD
    subgraph Client Application
        SDK["Express SDK (Middleware & Collector)"]
    end

    subgraph API Gateway & Collector
        NGINX["Nginx Proxy (Port 80/443)"]
        API["Express Backend API (Port 4000)"]
    end

    subgraph Message Broker
        RMQ["RabbitMQ Exchange & Queue"]
    end

    subgraph Storage & Ingestion
        Worker["Metric Worker (Consumer)"]
        DB[(PostgreSQL Database)]
    end

    subgraph Background Analytics
        Cron["Cron Scheduler"]
        Agg["Aggregation Engine"]
        Alert["Alert Evaluator"]
    end

    subgraph UI Console
        Dash["React Dashboard (Vite)"]
    end

    %% Flow lines
    SDK -->|HTTPS POST /collect| NGINX
    NGINX -->|Forward /api| API
    API -->|publishMetric| RMQ
    RMQ -->|Consume| Worker
    Worker -->|Prisma Write| DB

    Cron -->|node-cron| Agg
    Cron -->|node-cron| Alert
    Agg -->|Aggregate Buckets| DB
    Alert -->|Read Metrics| DB
    Alert -->|Dispatch Alerts| Slack["Slack Webhook URL"]

    Dash -->|HTTPS Queries| NGINX
    API -->|Query Metrics / Auth| DB
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime & Language** | Node.js, TypeScript | v20, v5.9 | Core engine and static analysis |
| **Monorepo Build** | Turborepo, pnpm | v2.7.5, v10.19 | Multiclass dependency and build task pipeline |
| **Backend Framework** | Express, ts-node | v4.18, v10.9 | High-performance JSON HTTP routing |
| **Database & ORM** | PostgreSQL, Prisma | v6.0 | Relational storage, indexing, and object mapping |
| **Message Queue** | RabbitMQ (amqplib) | v3.13-mgmt | Direct exchange queue for async ingestion buffers |
| **Frontend UI** | React, Vite, Tailwind CSS | v18, v5, v3 | Reactive client dashboard console |
| **Proxy Routing** | Nginx | v1.27-alpine | Ingress reverse-proxy, SSL termination, and static asset serving |
| **Deployment Automation**| Kubernetes (k3s), Docker | - | Container builds and lightweight orchestration |
| **CI/CD Pipeline** | Jenkins | - | Multistage pipeline (Git Checkout -> Build -> Deploy) |

---

## Project Structure

```text
backend_monitoring/
├── docker-compose.yml        # Multi-container local orchestration (RabbitMQ, Backend, Dashboard, Nginx)
├── Jenkinsfile               # Jenkins CI/CD pipeline script targeting EC2 and k3s
├── tsconfig.base.json        # Base tsconfig inherited by packages and apps
├── turbo.json                # Turborepo task build configurations
├── package.json              # Monorepo workspace root package definition
│
├── apps/
│   ├── Backend/              # Core API Server, metric worker, and cron jobs
│   │   ├── prisma/           # PostgreSQL Schema (schema.prisma) and migration scripts
│   │   └── src/
│   │       ├── config/       # DB, Google OAuth, and RabbitMQ connection wrappers
│   │       ├── controllers/  # Route controller logic (Auth, Projects, Metrics, Alerts)
│   │       ├── jobs/         # Background tasks (node-cron aggregation, alert evaluator, metric worker)
│   │       ├── middleware/   # Token validation and error middlewares
│   │       ├── routes/       # API router setups (/auth, /projects, /collect, /metrics, /alerts)
│   │       └── index.ts      # Main server entrypoint bootstraps express, db, queue and jobs
│   │
│   ├── dashboard/            # React/Vite dashboard client SPA
│   │   ├── src/
│   │   │   ├── pages/        # Dashboard layout pages (LandingPage, ProjectDashboard, ServiceMetricsPage)
│   │   │   ├── services/     # Axios API connection endpoints
│   │   │   └── App.tsx       # Main router structure
│   │   └── Dockerfile        # Docker build config deploying the Vite build to Nginx production container
│   │
│   └── test-app/             # SDK validation harness application
│       └── src/
│           ├── index.ts      # Instrumented mock Express server with custom mock endpoints
│           └── traffic-generator.ts # Automatic random load simulation worker script
│
├── packages/
│   ├── sdk/                  # Lightweight Node.js Express SDK
│   │   └── src/
│   │       ├── middleware/   # Express middleware capturing duration, status, and path
│   │       ├── collectors/   # CPU / Memory system metrics loop
│   │       └── transport/    # Robust HTTP metric sender client
│   │
│   └── shared-types/         # Shared TypeScript interfaces for request and system structures
│
├── k8s/                      # Kubernetes deployment specifications (backend, dashboard, ingress, rabbitmq)
└── nginx/
    └── default.conf          # Local/prod Nginx proxy rules for infrawatch.mooo.com
```

---

## Getting Started

### Prerequisites
*   **Node.js**: v20 or higher
*   **pnpm**: v10.19.0 or higher
*   **Docker & Docker Compose** (required for RabbitMQ/PostgreSQL services)
*   **PostgreSQL**: Local database instance (if not running database in Docker)
*   **RabbitMQ**: Message queue instance (if running components bare-metal)

### Local Development Setup

#### 1. Clone the repository
```bash
git clone https://github.com/Atithi2908/Backend_monitoring_system.git
cd Backend_monitoring_system
```

#### 2. Install workspace dependencies
Install all dependencies using `pnpm`:
```bash
pnpm install
```

#### 3. Configure environment variables
Create `.env` files in both the Backend and Dashboard directories based on their examples.

In `apps/Backend/.env`:
```env
PORT=4000
HOST=0.0.0.0
DATABASE_URL="postgresql://postgres:password@localhost:5432/backend_monitoring?schema=public"
JWT_SECRET="your-jwt-signing-secret"
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
RABBITMQ_URL="amqp://localhost:5672"

# Google OAuth
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/auth/google/callback"
FRONTEND_AUTH_REDIRECT_URL="http://localhost:5173/"
```

In `apps/dashboard/.env`:
```env
VITE_API_BASE_URL=http://localhost:4000
```

#### 4. Setup the Database Schema
Ensure PostgreSQL is running, then apply the migrations and generate the Prisma Client:
```bash
pnpm --filter @backend-monitoring/backend exec prisma migrate dev
```

#### 5. Run the Local Development Environment
Start RabbitMQ via Docker Compose (or ensure a local instance is running):
```bash
docker compose up -d rabbitmq
```

Run all workspace applications in development mode simultaneously:
```bash
pnpm dev
```
This runs:
*   **Collector API Server** on `http://localhost:4000`
*   **React Dashboard SPA** on `http://localhost:5173`

---

## SDK Integration

To monitor your own Express applications, install the built SDK package:

```bash
pnpm add backend-monitoring-sdk
# or
npm install backend-monitoring-sdk
```

### SDK Usage
Integrate the SDK middleware and system metric collector into your main server bootstrap:

```typescript
import express from "express";
import { monitorMiddleware, startSystemMetrics } from "backend-monitoring-sdk";

const app = express();

const monitorConfig = {
  serviceName: "orders-service",
  collectorUrl: "http://localhost:4000/collect",
  apiKey: "your-project-api-key-here",
};

// 1. Ingest request metrics
app.use(monitorMiddleware(monitorConfig));

// 2. Ingest system metrics (CPU/Memory) every 10 seconds
startSystemMetrics(monitorConfig, 10000);

app.get("/api/v1/orders", (req, res) => {
  res.status(200).json([{ id: 1, total: 99.99 }]);
});

app.listen(3000, () => {
  console.log("Service listening on port 3000");
});
```

---

## API Reference

### Auth Endpoints (`/auth`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup` | None | Register a new user |
| `POST` | `/auth/signin` | None | Log in with password, returns JWT |
| `GET` | `/auth/me` | JWT | Get logged-in user profile details |
| `GET` | `/auth/google/start` | None | Initiates OAuth redirect to Google |
| `GET` | `/auth/google/callback`| None | Target redirect callback endpoint for Google Auth |

### Project & Service Endpoints (`/projects` & `/create`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/create/project` | JWT | Create a new project |
| `POST` | `/create/apikey/:projectId` | JWT | Create / Rotate API Key for a project |
| `POST` | `/create/service` | JWT | Manually add a service to a project |
| `GET` | `/projects` | JWT | Get all projects owned by the user |
| `GET` | `/projects/:projectId` | JWT | Fetch detailed metadata for a project |
| `GET` | `/projects/:projectId/services` | JWT | Retrieve all monitored services in a project |
| `PATCH`| `/projects/:projectId/status` | JWT | Update the project status (e.g. ACTIVE) |
| `PATCH`| `/projects/:projectId/slack-webhook` | JWT | Update Slack notification endpoint URL |
| `DELETE`| `/projects/:projectId` | JWT | Delete a project and cascade metrics |

### Ingestion Endpoints (`/collect`)
| Method | Endpoint | Header Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/collect` | `x-api-key` | Ingests a raw request or system metric payload |

### Metrics Querying (`/metrics`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/metrics/request` | JWT | Get request metrics (filters: projectId, serviceName, range) |
| `GET` | `/metrics/system` | JWT | Get CPU/Memory metrics (filters: projectId, serviceName, range) |
| `GET` | `/metrics/overview` | JWT | Get system-wide service availability status summaries |

### Alerting Rules (`/alerts`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/alerts` | JWT | Retrieve active alert rules config list |
| `POST` | `/alerts` | JWT | Create a new metric trigger threshold evaluation rule |
| `PATCH`| `/alerts/:id` | JWT | Update configuration properties of an alert rule |

---

## How It Works

1.  **Metric Capture**: The client application's Express request lifecycle fires the SDK middleware on response `"finish"`. The SDK computes elapsed execution time, records status, maps matched express route path, and compiles a `RequestMetric` payload.
2.  **HTTP Dispatch**: The SDK sends compiled payloads to the `/collect` endpoint of the Collector API Server. Transmission runs safely wrapped to prevent client-application failures if the collector is unreachable.
3.  **Queue Pipeline**: The collector API processes request headers to validate the `x-api-key`. Once valid, the collector API enqueues the payload into **RabbitMQ** direct exchange (`metrics_exchange`) and returns a fast `202 Accepted` status.
4.  **Asynchronous Worker**: The `startMetricWorker` consumer processes metrics from the queue. It performs an upsert of the monitored service's registry, and persists metrics into PostgreSQL tables (`request_metrics` or `system_metrics`).
5.  **Analytics Aggregation**: The aggregation cron job runs on minutes, hours, and daily schedules using `node-cron`. It extracts raw metrics, compiles averages, error counts, maximums, and percentiles (like p95 latency), and stores results in metric aggregate tables, reducing data footprint and speeding up dashboard load times.
6.  **Alert Evaluation**: Every minute, the alert evaluator cron job matches defined `AlertRule` entries against average values over specified sliding windows (e.g., *avgLatencyMs > 500ms in the last 5 minutes*). If criteria are met, an alert state is flagged and a notification payload is fired to the configured Slack webhook.
7.  **Visual Dashboard**: The dashboard application makes API requests to the query endpoints, fetching historical aggregate tables to plot charts (ApexCharts or similar) mapping latency, error rate, CPU utilization, and memory usage.

---

## Deployment

### Docker Compose Local Deployment
To build and run the entire environment locally under Nginx reverse proxy:
```bash
docker compose up --build -d
```
The application will be accessible at:
*   Dashboard Front-end: `http://localhost` (proxied to port 80)
*   Collector API Endpoints: `http://localhost/api/` (proxied to port 4000)

### Kubernetes Production Deployment
Apply the directory manifests inside `k8s/` onto your Kubernetes cluster:
```bash
kubectl apply -f k8s/
```
These manifests set up:
*   RabbitMQ stateful services.
*   The Collector/API Deployment.
*   The Vite Dashboard Deployment.
*   Ingress routes mapping hosts to services.

### CI/CD Deployment via Jenkins
The provided [Jenkinsfile](file:///c:/Users/atith/backend_monitoring/Jenkinsfile) automates the release lifecycle:
1.  **Checkout Code**: Pulls the target repository code to the agent host.
2.  **Build and Local Import**: Connects to the host EC2 engine, builds production Docker images (`Dockerfile` and `Dockerfile.jenkins` contexts), and exports them directly into the `containerd` database storage engine of `k3s`.
3.  **Manifest Apply**: Applies the updated Kubernetes manifests within the `k8s/` directory.

---

## Contributing
1.  Fork the repository and create a feature branch (`git checkout -b feature/cool-feature`).
2.  Ensure local validation tests pass by running your improvements alongside `apps/test-app`.
3.  Commit changes utilizing concise, clear semantic messages.
4.  Open a Pull Request to the `main` branch.
