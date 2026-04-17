import app from "./app";
import { env } from "./config/env";
import { startHealthCheck } from "./config/supabase";
import { verifyCriticalSchema } from "./utils/startupSchemaCheck";
import { startBillingScheduler } from "./utils/billingScheduler";

const PORT = env.PORT;

async function startServer() {
  try {
    await verifyCriticalSchema();

    startHealthCheck();
    startBillingScheduler();

    app.listen(PORT, () => {
      console.log(`
  =========================================
    E-AMS API Server
    Environment: ${env.NODE_ENV}
    Port:        ${PORT}
    URL:         http://localhost:${PORT}
    Health:      http://localhost:${PORT}/api/health
  =========================================
  `);
    });
  } catch (error) {
    console.error("Startup failed during critical schema validation.");
    console.error(error);
    process.exit(1);
  }
}

void startServer();
