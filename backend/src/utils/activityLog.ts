import { supabaseAdmin } from "../config/supabase";

interface LogEntry {
  apartmentowner_id: string;
  apartment_id?: string | null;
  actor_id?: string | string[] | null;
  actor_name: string;
  actor_role: "owner" | "manager" | "tenant" | "system";
  action: string;
  entity_type?: string | null;
  entity_id?: string | string[] | null;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert a log entry into apartment_logs.
 * Fires and forgets — does not throw on failure to avoid blocking the main operation.
 */
export async function logActivity(entry: LogEntry): Promise<void> {
  try {
    await supabaseAdmin.from("apartment_logs").insert({
      apartmentowner_id: entry.apartmentowner_id,
      apartment_id: Array.isArray(entry.apartment_id) ? entry.apartment_id[0] || null : entry.apartment_id || null,
      actor_id: Array.isArray(entry.actor_id) ? entry.actor_id[0] || null : entry.actor_id || null,
      actor_name: entry.actor_name,
      actor_role: entry.actor_role,
      action: entry.action,
      entity_type: entry.entity_type || null,
      entity_id: Array.isArray(entry.entity_id) ? entry.entity_id[0] || null : entry.entity_id || null,
      description: entry.description,
      metadata: entry.metadata || {},
    });
  } catch (err) {
    console.error("[logActivity] Failed to write log:", err);
  }
}

/**
 * Compute field changes between old and new objects.
 * Returns a record of { fieldName: { from, to } } for fields that differ.
 */
export function diffFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): Record<string, { from: string; to: string }> {
  const changes: Record<string, { from: string; to: string }> = {};
  for (const field of fields) {
    const oldVal = String(oldObj[field] ?? "");
    const newVal = String(newObj[field] ?? "");
    if (oldVal !== newVal) {
      changes[field] = { from: oldVal, to: newVal };
    }
  }
  return changes;
}
