WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "projectId",
        "serviceName",
        "metricType",
        "metricField",
        "operator",
        COALESCE("endpoint", '__all__')
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "AlertRule"
)
DELETE FROM "AlertRule" a
USING ranked r
WHERE a."id" = r."id"
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_alert_rule_key"
ON "AlertRule" (
  "projectId",
  "serviceName",
  "metricType",
  "metricField",
  "operator",
  COALESCE("endpoint", '__all__')
);
