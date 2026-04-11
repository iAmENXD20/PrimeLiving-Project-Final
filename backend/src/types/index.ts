import { Request } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

// ── User Roles ──
export type UserRole = "owner" | "manager" | "tenant";

// ── Authenticated Request ──
// Extends Express Request with user info after auth middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
  supabase?: SupabaseClient;
  token?: string;
}

// ── Database Table Types ──

export interface Owner {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
}

export interface Manager {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string;
  apartmentowner_id: string;
  status: string;
  created_at: string;
}

export interface Apartment {
  id: string;
  name: string;
  address: string;
  monthly_rent: number;
  total_units: number;
  apartmentowner_id: string;
  manager_id: string | null;
  payment_due_day: number;
  status: string;
  created_at: string;
}

export interface Tenant {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  unit_id: string;
  apartmentowner_id: string;
  status: string;
  move_in_date: string;
  created_at: string;
}

export interface MaintenanceRequest {
  id: string;
  tenant_id: string;
  unit_id: string;
  apartmentowner_id: string;
  title: string;
  description: string;
  priority: string;
  status: "pending" | "in_progress" | "resolved" | "closed";
  photo_url: string | null;
  created_at: string;
}

export interface Revenue {
  id: string;
  unit_id: string;
  apartmentowner_id: string;
  amount: number;
  month: string;
  description: string;
  created_at: string;
}

export interface Payment {
  id: string;
  apartmentowner_id: string;
  tenant_id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  status: string;
  payment_mode: "gcash" | "maya" | "cash" | "bank_transfer";
  receipt_url: string | null;
  verification_status: "pending_verification" | "verified" | "approved" | "rejected" | null;
  period_from: string;
  period_to: string;
  created_at: string;
}

export interface Document {
  id: string;
  apartmentowner_id: string;
  unit_id: string;
  tenant_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: string;
  description: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  apartmentowner_id: string;
  unit_id: string | null;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface ApartmentLog {
  id: string;
  arc_id: string;
  apartmentowner_id: string;
  apartment_id: string | null;
  actor_id: string | null;
  actor_name: string;
  actor_role: "owner" | "manager" | "tenant" | "system";
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── API Response Types ──

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
