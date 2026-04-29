import { Request, Response } from "express";
import { prisma } from "../config/database";
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key]);
    }
    return serialized;
  }
  
  return obj;
}

export async function getMetricsDebug(req: Request, res: Response) {
  try {
    const requestMetrics = await prisma.requestMetric.findMany({
      orderBy: {
        receivedAt: 'desc'
      },
      take: 100 
    });

    const systemMetrics = await prisma.systemMetric.findMany({
      orderBy: {
        receivedAt: 'desc'
      },
      take: 100 
    });

  
    const serializedRequestMetrics = serializeBigInt(requestMetrics);
    const serializedSystemMetrics = serializeBigInt(systemMetrics);

    res.json({
      requestMetrics: {
        count: serializedRequestMetrics.length,
        data: serializedRequestMetrics
      },
      systemMetrics: {
        count: serializedSystemMetrics.length,
        data: serializedSystemMetrics
      },
      total: serializedRequestMetrics.length + serializedSystemMetrics.length
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
}
