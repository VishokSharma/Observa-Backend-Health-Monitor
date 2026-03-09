import { BaseMetric } from "./metric-base";
import { MetricType } from "./metric-type";

export interface SystemMetric extends BaseMetric {
  type: MetricType.SYSTEM;

  cpuUsagePercent: number;
  memoryUsageMb: number;
}
