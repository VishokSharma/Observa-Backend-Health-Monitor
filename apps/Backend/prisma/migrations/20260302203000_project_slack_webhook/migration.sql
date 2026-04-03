ALTER TABLE "Project"
ADD COLUMN "slackWebhookUrl" TEXT;

UPDATE "Project" p
SET "slackWebhookUrl" = s."webhookUrl"
FROM (
  SELECT DISTINCT ON ("projectId") "projectId", "webhookUrl"
  FROM "AlertRule"
  WHERE "webhookUrl" IS NOT NULL
  ORDER BY "projectId", "createdAt" DESC
) s
WHERE p."id" = s."projectId"
  AND p."slackWebhookUrl" IS NULL;

ALTER TABLE "AlertRule"
DROP COLUMN "webhookUrl";
