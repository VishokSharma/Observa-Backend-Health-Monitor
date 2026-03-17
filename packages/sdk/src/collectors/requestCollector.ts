import { RequestMetric, MetricType } from "../types";
import { SdkConfig } from "../config/sdkConfig";

export function collectRequestMetric(
  config: SdkConfig,
  data: {
    method: string;
    route: string;
    statusCode: number;
    latencyMs: number;
  }
): RequestMetric {
  return {
    type: MetricType.REQUEST,
    serviceName: config.serviceName,
    timestamp: Date.now(),

    method: data.method,
    route: data.route,
    statusCode: data.statusCode,
    latencyMs: data.latencyMs,
    isError: data.statusCode >= 500
  };
}
