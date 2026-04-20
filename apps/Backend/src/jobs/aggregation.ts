import cron from "node-cron";
import { runSystemAggregation } from "../services/aggregation/systemAggregator";
import { runRequestAggregation } from "../services/aggregation/requestAggregator";
import { runSystemHourAggregation } from "../services/aggregation/systemAggregatorHour";
import { runRequestHourAggregation } from "../services/aggregation/requestAggregatorHour";
import { runSystemDayAggregation } from "../services/aggregation/systemAggregatorDay";
import { runRequestDayAggregation } from "../services/aggregation/requestAggregatorDay";

export function startAggregationJob() {
  console.log("Starting aggregation cron job...");

  // Runs every minute
  cron.schedule("* * * * *", async () => {
    console.log("Running minute aggregation...");

    try {
      await runSystemAggregation();
      await runRequestAggregation();
    } catch (error) {
      console.error("Aggregation error:", error);
    }
  });
  cron.schedule("0 * * * *", async () => {
    try {
      await runSystemHourAggregation();
      await runRequestHourAggregation();
    } catch (error) {
      console.error("Hour aggregation error:", error);
    }
  });
  cron.schedule("0 0 * * *", async () => {
 // console.log("Running day aggregation...");

  try {
    await runSystemDayAggregation();
    await runRequestDayAggregation();
  } catch (error) {
   console.error("Day aggregation error:", error);
  }
});
}
