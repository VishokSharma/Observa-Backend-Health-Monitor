import { Router } from "express";
import { validateApiKey } from "../middleware/apiKeyAuth";
import { collectMetric } from "../controllers/collect.controller";

export const collectRouter: Router = Router();

collectRouter.post("/", validateApiKey, collectMetric);
