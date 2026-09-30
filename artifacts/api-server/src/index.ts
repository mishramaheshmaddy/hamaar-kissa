import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { startNotificationScheduler } from "./lib/notificationScheduler";
import { ensureNotificationAnalyticsSchema } from "./lib/notificationAnalyticsSchema";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    await ensureNotificationAnalyticsSchema();
  } catch (err) {
    logger.error({ err }, "Notification analytics schema setup failed");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startNotificationScheduler();
  });
}

void startServer();
