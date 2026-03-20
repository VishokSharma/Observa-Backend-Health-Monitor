
export function getMemoryUsageMb(): number {
  const memoryBytes = process.memoryUsage().rss;
  return Math.round((memoryBytes / 1024 / 1024) * 100) / 100;
}


export function getCpuUsagePercent(
  prevUsage: NodeJS.CpuUsage,
  intervalMs: number
): number {
  const currentUsage = process.cpuUsage(prevUsage);

  const totalCpuTimeMicros =
    currentUsage.user + currentUsage.system;

  const elapsedMicros = intervalMs * 1000;

  return Math.round(
    (totalCpuTimeMicros / elapsedMicros) * 100
  );
}