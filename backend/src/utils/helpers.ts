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

  // Cache-Control: no caching — realtime subscriptions handle freshness
  if (res.req?.method === "GET") {
    res.set("Cache-Control", "no-store");
  }

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
const MANAGER_SCOPE_TTL_MS = 10_000; // 10 seconds — short TTL for realtime responsiveness
const MANAGER_SCOPE_MAX_ENTRIES = 100;
const managerScopeCache = new Map<string, { data: { apartmentIds: string[]; unitIds: string[] }; expires: number }>();

/**
 * Invalidate the manager scope cache for a specific manager.
 * Call this whenever a manager's apartment assignment changes or
 * when units are added/removed from a property managed by them.
 */
export function invalidateManagerScope(managerId: string): void {
  managerScopeCache.delete(managerId);
}

/**
 * Invalidate scope cache for all managers assigned to a specific property (apartment).
 * Call this when units are created/deleted under a property so that any
 * manager assigned to that property gets a fresh unit list on next request.
 */
export async function invalidateManagerScopeByProperty(propertyId: string): Promise<void> {
  const { data: managers } = await supabaseAdmin
    .from("apartment_managers")
    .select("id")
    .eq("apartment_id", propertyId);

  if (managers && managers.length > 0) {
    for (const m of managers) {
      managerScopeCache.delete(m.id);
    }
  }
}

/**
 * Invalidate the entire manager scope cache.
 * Use sparingly — prefer targeted invalidation.
 */
export function invalidateAllManagerScopes(): void {
  managerScopeCache.clear();
}

export async function getManagerScope(managerId: string): Promise<{ apartmentIds: string[]; unitIds: string[]; ownerId: string | null }> {
  const cached = managerScopeCache.get(managerId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const { data: manager } = await supabaseAdmin
    .from("apartment_managers")
    .select("apartment_id, apartmentowner_id")
    .eq("id", managerId)
    .single();

  const apartmentIds = manager?.apartment_id ? [manager.apartment_id] : [];
  const ownerId: string | null = manager?.apartmentowner_id || null;

  if (apartmentIds.length === 0) {
    const result = { apartmentIds: [], unitIds: [], ownerId };
    managerScopeCache.set(managerId, { data: result, expires: Date.now() + MANAGER_SCOPE_TTL_MS });
    return result;
  }

  const { data: units } = await supabaseAdmin
    .from("units")
    .select("id")
    .in("apartment_id", apartmentIds);

  const unitIds = (units || []).map((u: any) => u.id);

  const result = { apartmentIds, unitIds, ownerId };
  managerScopeCache.set(managerId, { data: result, expires: Date.now() + MANAGER_SCOPE_TTL_MS });

  // Cleanup stale entries periodically
  if (managerScopeCache.size > MANAGER_SCOPE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, val] of managerScopeCache) {
      if (val.expires <= now) managerScopeCache.delete(key);
    }
  }

  return result;
}
