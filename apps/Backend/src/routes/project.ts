import { Router } from "express";
import {
  getUserProjects,
  getProjectDetails,
  getProjectServices,
  deleteProject,
  updateProjectStatus,
  setProjectSlackWebhook,
} from "../controllers/project";
import { authenticateToken } from "../middleware/jwtAuth";

const projectRouter: Router = Router();

// All project routes require authentication
projectRouter.get("/", authenticateToken, getUserProjects);
projectRouter.get("/:projectId", authenticateToken, getProjectDetails);
projectRouter.get("/:projectId/services", authenticateToken, getProjectServices);
projectRouter.patch("/:projectId/status", authenticateToken, updateProjectStatus);
projectRouter.patch("/:projectId/slack-webhook", authenticateToken, setProjectSlackWebhook);
projectRouter.delete("/:projectId", authenticateToken, deleteProject);

export default projectRouter;
