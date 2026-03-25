-- CreateTable
CREATE TABLE "request_metrics" (
    "id" BIGSERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "isError" BOOLEAN NOT NULL,

    CONSTRAINT "request_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" BIGSERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsagePercent" DOUBLE PRECISION NOT NULL,
    "memoryUsageMb" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_request_project_time" ON "request_metrics"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_request_route" ON "request_metrics"("route");

-- CreateIndex
CREATE INDEX "idx_request_errors" ON "request_metrics"("projectId", "isError");

-- CreateIndex
CREATE INDEX "idx_system_project_time" ON "system_metrics"("projectId", "timestamp");
