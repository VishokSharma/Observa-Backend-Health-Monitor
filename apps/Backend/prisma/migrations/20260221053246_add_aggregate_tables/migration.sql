-- DropIndex
DROP INDEX "idx_system_project_time";

-- CreateTable
CREATE TABLE "RequestMetricAggregate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "minuteBucket" BIGINT NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "clientErrorCount" INTEGER NOT NULL,
    "serverErrorCount" INTEGER NOT NULL,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,
    "maxResponseTime" DOUBLE PRECISION NOT NULL,
    "p95ResponseTime" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMetricAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metric_aggregates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "minuteBucket" BIGINT NOT NULL,
    "avgCpu" DOUBLE PRECISION NOT NULL,
    "maxCpu" DOUBLE PRECISION NOT NULL,
    "avgMemoryMb" DOUBLE PRECISION NOT NULL,
    "maxMemoryMb" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metric_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestMetricAggregate_projectId_serviceName_route_method_m_idx" ON "RequestMetricAggregate"("projectId", "serviceName", "route", "method", "minuteBucket");

-- CreateIndex
CREATE INDEX "RequestMetricAggregate_projectId_serviceName_minuteBucket_idx" ON "RequestMetricAggregate"("projectId", "serviceName", "minuteBucket");

-- CreateIndex
CREATE UNIQUE INDEX "RequestMetricAggregate_projectId_serviceName_route_method_m_key" ON "RequestMetricAggregate"("projectId", "serviceName", "route", "method", "minuteBucket");

-- CreateIndex
CREATE INDEX "system_metric_aggregates_projectId_serviceName_minuteBucket_idx" ON "system_metric_aggregates"("projectId", "serviceName", "minuteBucket");

-- CreateIndex
CREATE UNIQUE INDEX "system_metric_aggregates_projectId_serviceName_minuteBucket_key" ON "system_metric_aggregates"("projectId", "serviceName", "minuteBucket");

-- CreateIndex
CREATE INDEX "idx_system_project_time" ON "system_metrics"("projectId", "serviceName", "timestamp");
