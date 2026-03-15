import { supabaseAdmin } from "../config/supabase";

const CRITICAL_TABLES = [
  "clients",
  "apartments",
  "units",
  "managers",
  "tenants",
  "announcements",
  "notifications",
  "payments",
  "maintenance",
] as const;

export async function verifyCriticalSchema(): Promise<void> {
  const missingTables: string[] = [];
  const inaccessibleTables: string[] = [];

  for (const tableName of CRITICAL_TABLES) {
    const { error } = await supabaseAdmin
      .from(tableName)
      .select("*", { head: true, count: "exact" })
      .limit(1);

    if (!error) {
      continue;
    }

    if (error.code === "42P01") {
      missingTables.push(tableName);
      continue;
    }

    inaccessibleTables.push(`${tableName} (${error.code ?? "unknown"})`);
  }

  if (missingTables.length > 0 || inaccessibleTables.length > 0) {
    const details = [
      missingTables.length
        ? `Missing tables: ${missingTables.join(", ")}`
        : null,
      inaccessibleTables.length
        ? `Inaccessible tables: ${inaccessibleTables.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    throw new Error(`Critical schema validation failed. ${details}`);
  }

  console.log(
    `Schema validation passed: ${CRITICAL_TABLES.length} critical tables available.`
  );
}
