import app from "./app";
import { env } from "./config/env";

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`
  =========================================
    PrimeLiving API Server
    Environment: ${env.NODE_ENV}
    Port:        ${PORT}
    URL:         http://localhost:${PORT}
    Health:      http://localhost:${PORT}/api/health
  =========================================
  `);
});
