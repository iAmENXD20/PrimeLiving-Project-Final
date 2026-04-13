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
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive";
  updated_at: string;
}

export interface Manager {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  sex: string | null;
  age: string | null;
  apartmentowner_id: string | null;
  apartment_id: string | null;
  id_type: string | null;
  id_type_other: string | null;
  id_front_photo_url: string | null;
  id_back_photo_url: string | null;
  status: "active" | "inactive" | "pending" | "pending_verification";
  joined_date: string;
  created_at: string;
  updated_at: string;
}

export interface ApartmentProperty {
  id: string;
  apartmentowner_id: string | null;
  name: string;
  address: string | null;
  address_region: string | null;
  address_region_code: string | null;
  address_province: string | null;
  address_province_code: string | null;
  address_city: string | null;
  address_city_code: string | null;
  address_district: string | null;
  address_district_code: string | null;
  address_area: string | null;
  address_area_code: string | null;
  address_barangay: string | null;
  address_barangay_code: string | null;
  address_street: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  name: string;
  apartment_id: string | null;
  apartmentowner_id: string | null;
  manager_id: string | null;
  monthly_rent: number;
  total_units: number;
  payment_due_day: number | null;
  max_occupancy: number | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface UnitOccupant {
  id: string;
  unit_id: string;
  tenant_id: string;
  full_name: string;
  id_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  sex: string | null;
  age: string | null;
  unit_id: string | null;
  apartment_id: string | null;
  apartmentowner_id: string | null;
  id_type: string | null;
  id_type_other: string | null;
  id_front_photo_url: string | null;
  id_back_photo_url: string | null;
  status: "active" | "inactive" | "pending" | "pending_verification";
  move_in_date: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequest {
  id: string;
  tenant_id: string | null;
  unit_id: string | null;
  apartmentowner_id: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "resolved" | "closed";
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Revenue {
  id: string;
  apartment_id: string | null;
  apartmentowner_id: string | null;
  amount: number;
  month: string;
  description: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  apartmentowner_id: string | null;
  tenant_id: string | null;
  unit_id: string | null;
  apartment_id: string | null;
  amount: number;
  payment_date: string;
  status: "paid" | "pending" | "overdue";
  description: string | null;
  payment_mode: "gcash" | "maya" | "cash" | "bank_transfer" | null;
  receipt_url: string | null;
  verification_status: "pending_verification" | "verified" | "approved" | "rejected" | null;
  period_from: string | null;
  period_to: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  apartmentowner_id: string | null;
  apartment_id: string | null;
  tenant_id: string | null;
  uploaded_by: string | null;
  file_name: string;
  file_url: string;
  file_type: string;
  description: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  apartmentowner_id: string | null;
  apartment_id: string | null;
  title: string;
  message: string;
  created_by: string | null;
  recipient_tenant_ids: string[] | null;
  created_at: string;
}

export interface Notification {
  id: string;
  apartmentowner_id: string | null;
  apartment_id: string | null;
  recipient_role: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface SmsLog {
  id: string;
  phone: string;
  message: string;
  status: "sent" | "failed";
  error: string | null;
  apartment_id: string | null;
  created_at: string;
}

export interface ApartmentLog {
  id: string;
  apartmentowner_id: string | null;
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
