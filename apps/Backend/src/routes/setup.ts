import { Router } from "express";
import { createApiKey, createProject, createService } from "../controllers/setup";
import { authenticateToken } from "../middleware/jwtAuth";

const setupRouter: Router = Router();

// All setup routes require authentication
setupRouter.post("/apikey/:projectId", authenticateToken, createApiKey);
setupRouter.post("/project", authenticateToken, createProject);
setupRouter.post("/service", authenticateToken, createService);

export default setupRouter;