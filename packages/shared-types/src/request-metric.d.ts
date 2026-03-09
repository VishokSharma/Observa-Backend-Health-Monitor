import { BaseMetric } from "./metric-base";
import { MetricType } from "./metric-type";
export interface RequestMetric extends BaseMetric {
    type: MetricType.REQUEST;
    method: string;
    route: string;
    statusCode: number;
    latencyMs: number;
    isError: boolean;
}
