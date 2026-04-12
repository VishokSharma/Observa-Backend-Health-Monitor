import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";

export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKey = req.header("x-api-key");

    if (!apiKey) {
      return res.status(401).json({ error: "API key missing" });
    }

    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
    });

    if (!keyRecord || !keyRecord.isActive) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    
    (req as any).projectId = keyRecord.projectId;

    next();
  } catch (error) {
    console.error("API key validation error:", error);
    return res.status(500).json({ error: "API key validation failed" });
  }
}