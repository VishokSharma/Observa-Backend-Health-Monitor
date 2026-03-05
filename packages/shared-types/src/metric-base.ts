import { MetricType } from "./metric-type";

export interface BaseMetric {
  serviceName: string;   
  timestamp: number;     
  type: MetricType;
}
