import { Router } from "express";
import { getRequestMetrics, getSystemMetrics } from "../controllers/getMetrics";
import { getServiceOverview } from "../controllers/overview";

export const metricsRouter:Router = Router();
metricsRouter.get("/request", getRequestMetrics);
metricsRouter.get("/system", getSystemMetrics);
metricsRouter.get("/overview", getServiceOverview);