import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiResponse } from "../types";

// Standard success response
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
}

// Standard error response
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 400
): void {
  const response: ApiResponse = {
    success: false,
    error,
  };
  res.status(statusCode).json(response);
}

// Generate a random password (same logic as frontend)
export function generateRandomPassword(length: number = 12): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Get the apartment IDs and unit IDs managed by a specific manager.
 * Uses a short-lived in-memory cache (30s) to avoid redundant DB queries
 * when multiple endpoints are called in quick succession.
 */
const managerScopeCache = new Map<string, { data: { apartmentIds: string[]; unitIds: string[] }; expires: number }>();

export async function getManagerScope(managerId: string): Promise<{ apartmentIds: string[]; unitIds: string[] }> {
  const cached = managerScopeCache.get(managerId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const { data: manager } = await supabaseAdmin
    .from("apartment_managers")
    .select("apartment_id")
    .eq("id", managerId)
    .single();

  const apartmentIds = manager?.apartment_id ? [manager.apartment_id] : [];

  if (apartmentIds.length === 0) {
    const result = { apartmentIds: [], unitIds: [] };
    managerScopeCache.set(managerId, { data: result, expires: Date.now() + 30_000 });
    return result;
  }

  const { data: units } = await supabaseAdmin
    .from("units")
    .select("id")
    .in("apartment_id", apartmentIds);

  const unitIds = (units || []).map((u: any) => u.id);

  const result = { apartmentIds, unitIds };
  managerScopeCache.set(managerId, { data: result, expires: Date.now() + 30_000 });

  // Cleanup stale entries periodically
  if (managerScopeCache.size > 100) {
    const now = Date.now();
    for (const [key, val] of managerScopeCache) {
      if (val.expires <= now) managerScopeCache.delete(key);
    }
  }

  return result;
}
