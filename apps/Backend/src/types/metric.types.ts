export enum MetricType {
  REQUEST = "request",
  SYSTEM = "system",
}

export interface BaseMetric {
  serviceName: string;
  timestamp: number;
  type: MetricType;
}

export interface RequestMetric extends BaseMetric {
  type: MetricType.REQUEST;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  isError: boolean;
}

export interface SystemMetric extends BaseMetric {
  type: MetricType.SYSTEM;
  cpuUsagePercent: number;
  memoryUsageMb: number;
}
