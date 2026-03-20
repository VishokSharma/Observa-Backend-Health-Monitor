import type { Request, Response, NextFunction } from "express";
import { SdkConfig } from "../config/sdkConfig";
import { collectRequestMetric } from "../collectors/requestCollector";
import { safeExecute } from "../internal/safeExecution";
import { sendMetric } from "../transport/httpSender";

export function monitorMiddleware(config: SdkConfig) {
  return function (
    req: Request,   
    res: Response,
    next: NextFunction
  ) {
    const startTime = Date.now();

    res.on("finish", () => {
      safeExecute(() => {
        const latency = Date.now() - startTime;

        const metric = collectRequestMetric(config, {
          method: req.method,
          route: req.route?.path || req.path,
          statusCode: res.statusCode,
          latencyMs: latency
        });

        sendMetric(config, metric);
      });
    });

    next();
  };
}
