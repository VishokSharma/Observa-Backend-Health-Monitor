import { Router } from "express";
import { createAlertRule, getAlertRules, updateAlertRule } from "../controllers/alert";
import { authenticateToken } from "../middleware/jwtAuth";

const alertRouter: Router = Router();

alertRouter.get("/", authenticateToken, getAlertRules);
alertRouter.post("/", authenticateToken, createAlertRule);
alertRouter.patch("/:id", authenticateToken, updateAlertRule);

export default alertRouter;
