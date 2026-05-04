import { Router } from "express";
import { getMetricsDebug } from "../controllers/metricdebug";

export const metricsDebugRouter: Router = Router();

metricsDebugRouter.get("/metrics-debug", getMetricsDebug);
