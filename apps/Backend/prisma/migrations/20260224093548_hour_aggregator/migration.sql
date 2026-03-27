-- CreateTable
CREATE TABLE "RequestMetricAggregateDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "dayBucket" BIGINT NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "clientErrorCount" INTEGER NOT NULL,
    "serverErrorCount" INTEGER NOT NULL,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,
    "maxResponseTime" DOUBLE PRECISION NOT NULL,
    "p95ResponseTime" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMetricAggregateDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetricAggregateDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "dayBucket" BIGINT NOT NULL,
    "avgCpu" DOUBLE PRECISION NOT NULL,
    "maxCpu" DOUBLE PRECISION NOT NULL,
    "avgMemoryMb" DOUBLE PRECISION NOT NULL,
    "maxMemoryMb" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetricAggregateDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestMetricAggregateDay_projectId_serviceName_route_metho_idx" ON "RequestMetricAggregateDay"("projectId", "serviceName", "route", "method", "dayBucket");

-- CreateIndex
CREATE INDEX "RequestMetricAggregateDay_projectId_serviceName_dayBucket_idx" ON "RequestMetricAggregateDay"("projectId", "serviceName", "dayBucket");

-- CreateIndex
CREATE UNIQUE INDEX "RequestMetricAggregateDay_projectId_serviceName_route_metho_key" ON "RequestMetricAggregateDay"("projectId", "serviceName", "route", "method", "dayBucket");

-- CreateIndex
CREATE INDEX "SystemMetricAggregateDay_projectId_serviceName_dayBucket_idx" ON "SystemMetricAggregateDay"("projectId", "serviceName", "dayBucket");

-- CreateIndex
CREATE UNIQUE INDEX "SystemMetricAggregateDay_projectId_serviceName_dayBucket_key" ON "SystemMetricAggregateDay"("projectId", "serviceName", "dayBucket");
