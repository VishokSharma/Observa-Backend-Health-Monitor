export function isValidMetric(body: any): boolean {
  if (!body || typeof body !== "object") return false;

  if (!body.type || !body.serviceName || !body.timestamp) {
    return false;
  }

  if (body.type === "request") {
    return (
      typeof body.method === "string" &&
      typeof body.route === "string" &&
      typeof body.statusCode === "number" &&
      typeof body.latencyMs === "number"
    );
  }

  if (body.type === "system") {
    return (
      typeof body.cpuUsagePercent === "number" &&
      typeof body.memoryUsageMb === "number"
    );
  }

  return false;
}
