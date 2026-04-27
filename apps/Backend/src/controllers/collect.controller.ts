import { Request, Response } from "express";
import { isValidMetric } from "../utils/validate";
import { publishMetric } from "../config/rabbit";

export const collectMetric = async (req: Request, res: Response) => {
  try {
    const metric = req.body;

    if (!isValidMetric(metric)) {
      return res.status(400).json({ error: "Invalid metric payload" });
    }

    const projectId = (req as any).projectId;
    publishMetric({ projectId, metric });

    res.status(202).json({ status: "queued" });
  } catch (error) {
    console.error("Error queueing metric:", error);
    res.status(500).json({ error: "Failed to queue metric" });
  }
};
