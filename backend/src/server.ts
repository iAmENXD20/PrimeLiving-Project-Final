import app from "./app";
import { env } from "./config/env";
import { verifyCriticalSchema } from "./utils/startupSchemaCheck";

const PORT = env.PORT;

async function startServer() {
  try {
    await verifyCriticalSchema();

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
