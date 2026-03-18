import { MetricType, SystemMetric } from "../types";
import { SdkConfig } from "../config/sdkConfig";
import {
  getCpuUsagePercent,
  getMemoryUsageMb
} from "../metrics/system";
import { sendMetric } from "../transport/httpSender";
import { safeExecute } from "../internal/safeExecution";

export function startSystemMetrics(
  config: SdkConfig,
  intervalMs: number = 10000
) {
  let previousCpuUsage = process.cpuUsage();

  setInterval(() => {
    safeExecute(() => {
      const cpu = getCpuUsagePercent(
        previousCpuUsage,
        intervalMs
      );

      previousCpuUsage = process.cpuUsage();

      const memory = getMemoryUsageMb();

      const metric: SystemMetric = {
        type: MetricType.SYSTEM,
        serviceName: config.serviceName,
        timestamp: Date.now(),
        cpuUsagePercent: cpu,
        memoryUsageMb: memory
      };

      sendMetric(config, metric);
    });
  }, intervalMs);
}
