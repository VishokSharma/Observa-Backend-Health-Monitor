-- CreateTable
CREATE TABLE "RequestMetricAggregateHour" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "hourBucket" BIGINT NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "clientErrorCount" INTEGER NOT NULL,
    "serverErrorCount" INTEGER NOT NULL,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,
    "maxResponseTime" DOUBLE PRECISION NOT NULL,
    "p95ResponseTime" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMetricAggregateHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetricAggregateHour" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "hourBucket" BIGINT NOT NULL,
    "avgCpu" DOUBLE PRECISION NOT NULL,
    "maxCpu" DOUBLE PRECISION NOT NULL,
    "avgMemoryMb" DOUBLE PRECISION NOT NULL,
    "maxMemoryMb" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetricAggregateHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestMetricAggregateHour_projectId_serviceName_route_meth_idx" ON "RequestMetricAggregateHour"("projectId", "serviceName", "route", "method", "hourBucket");

-- CreateIndex
CREATE INDEX "RequestMetricAggregateHour_projectId_serviceName_hourBucket_idx" ON "RequestMetricAggregateHour"("projectId", "serviceName", "hourBucket");

-- CreateIndex
CREATE UNIQUE INDEX "RequestMetricAggregateHour_projectId_serviceName_route_meth_key" ON "RequestMetricAggregateHour"("projectId", "serviceName", "route", "method", "hourBucket");

-- CreateIndex
CREATE INDEX "SystemMetricAggregateHour_projectId_serviceName_hourBucket_idx" ON "SystemMetricAggregateHour"("projectId", "serviceName", "hourBucket");

-- CreateIndex
CREATE UNIQUE INDEX "SystemMetricAggregateHour_projectId_serviceName_hourBucket_key" ON "SystemMetricAggregateHour"("projectId", "serviceName", "hourBucket");
