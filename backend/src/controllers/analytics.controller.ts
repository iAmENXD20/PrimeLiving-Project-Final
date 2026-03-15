import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/analytics/overview
 * Get overall system stats (admin dashboard)
 */
export async function getOverviewStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [clientsRes, managersRes, tenantsRes, apartmentsRes, inquiriesRes] =
      await Promise.all([
        supabaseAdmin
          .from("clients")
          .select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("managers")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabaseAdmin
          .from("tenants")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabaseAdmin
          .from("units")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabaseAdmin
          .from("inquiries")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

    const totalUsers =
      (clientsRes.count ?? 0) +
      (managersRes.count ?? 0) +
      (tenantsRes.count ?? 0);

    sendSuccess(res, {
      clients: clientsRes.count ?? 0,
      managers: managersRes.count ?? 0,
      tenants: tenantsRes.count ?? 0,
      apartments: apartmentsRes.count ?? 0,
      totalUsers,
      pendingInquiries: inquiriesRes.count ?? 0,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/owner/:clientId
 * Get owner-specific stats
 */
export async function getOwnerStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { clientId } = req.params;
    const monthParam = Number(req.query.month);
    const yearParam = Number(req.query.year);
    const hasMonthFilter =
      Number.isInteger(monthParam) &&
      Number.isInteger(yearParam) &&
      monthParam >= 1 &&
      monthParam <= 12 &&
      yearParam >= 2000;

    // Get apartment IDs for this client first
    const { data: apartments } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("client_id", clientId);

    const aptIds = (apartments || []).map((a: any) => a.id);

    const revenueQuery = supabaseAdmin
      .from("payments")
      .select("amount, payment_date")
      .eq("client_id", clientId)
      .eq("status", "paid");

    if (hasMonthFilter) {
      const start = new Date(Date.UTC(yearParam, monthParam - 1, 1));
      const end = new Date(Date.UTC(yearParam, monthParam, 1));
      revenueQuery
        .gte("payment_date", start.toISOString())
        .lt("payment_date", end.toISOString());
    }

    const [apartmentsRes, maintenanceRes, revenueRes] = await Promise.all([
      supabaseAdmin
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "active"),
      supabaseAdmin
        .from("maintenance")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "pending"),
      revenueQuery,
    ]);

    // Count active tenants in the client's apartments
    let activeTenants = 0;
    if (aptIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .in("unit_id", aptIds)
        .eq("status", "active");
      activeTenants = count ?? 0;
    }

    const totalRevenue =
      revenueRes.data?.reduce(
        (sum: number, r: any) => sum + (r.amount || 0),
        0
      ) || 0;

    sendSuccess(res, {
      apartments: apartmentsRes.count ?? 0,
      activeTenants,
      pendingMaintenance: maintenanceRes.count ?? 0,
      totalRevenue,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/owner/:clientId/detail-stats
 * Get detailed breakdown of tenants/managers for admin client detail view
 */
export async function getClientDetailStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { clientId } = req.params;

    // Get apartments for this client
    const { data: apartments } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("client_id", clientId);

    const aptIds = (apartments || []).map((a: any) => a.id);

    // Get tenants
    let tenantList: any[] = [];
    if (aptIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("tenants")
        .select("id, status")
        .in("unit_id", aptIds);
      tenantList = data || [];
    }

    // Get managers
    const { data: managers } = await supabaseAdmin
      .from("managers")
      .select("id, status")
      .eq("client_id", clientId);

    const managerList = managers || [];

    sendSuccess(res, {
      tenants: {
        active: tenantList.filter((t: any) => t.status === "active").length,
        inactive: tenantList.filter((t: any) => t.status !== "active").length,
        total: tenantList.length,
      },
      managers: {
        active: managerList.filter((m: any) => m.status === "active").length,
        inactive: managerList.filter((m: any) => m.status !== "active").length,
        total: managerList.length,
      },
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/manager/:managerId
 * Get manager-specific dashboard stats
 */
export async function getManagerStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { managerId } = req.params;
    const clientId = req.query.client_id as string;

    if (!clientId) {
      sendError(res, "client_id query parameter is required", 400);
      return;
    }

    // Get apartments managed by this manager
    const { data: managedApartments } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("manager_id", managerId)
      .eq("status", "active");

    let apartmentIds = (managedApartments || []).map((a: any) => a.id);

    // Fallback: if manager_id links are missing, use active apartments under the same client
    if (apartmentIds.length === 0) {
      const { data: clientApartments } = await supabaseAdmin
        .from("units")
        .select("id")
        .eq("client_id", clientId)
        .eq("status", "active");

      apartmentIds = (clientApartments || []).map((a: any) => a.id);
    }

    const [tenants, pendingMaintenance, allMaintenance] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .in("unit_id", apartmentIds.length ? apartmentIds : ["__none__"]),
      supabaseAdmin
        .from("maintenance")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("client_id", clientId),
      supabaseAdmin
        .from("maintenance")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

    // Get paid/unpaid tenants for current month
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    ).toISOString();

    const { data: paidPayments } = await supabaseAdmin
      .from("payments")
      .select("tenant_id")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth);

    const paidTenantIds = new Set(
      (paidPayments || [])
        .map((p: any) => p.tenant_id)
        .filter(Boolean)
    );
    const totalActiveTenants = tenants.count ?? 0;
    const paidTenants = paidTenantIds.size;
    const unpaidTenants = Math.max(0, totalActiveTenants - paidTenants);

    sendSuccess(res, {
      managedApartments: apartmentIds.length,
      activeTenants: totalActiveTenants,
      pendingMaintenance: pendingMaintenance.count ?? 0,
      totalMaintenance: allMaintenance.count ?? 0,
      paidTenants,
      unpaidTenants,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/tenant/:tenantId
 * Get tenant-specific dashboard stats
 */
export async function getTenantStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { tenantId } = req.params;

    const [maintenance, payments] = await Promise.all([
      supabaseAdmin
        .from("maintenance")
        .select("id, status")
        .eq("tenant_id", tenantId),
      supabaseAdmin
        .from("payments")
        .select("amount, status")
        .eq("tenant_id", tenantId),
    ]);

    const maintenanceData = maintenance.data || [];
    const paymentData = payments.data || [];

    const pendingMaintenance = maintenanceData.filter(
      (m: any) => m.status === "pending" || m.status === "in_progress"
    ).length;
    const resolvedMaintenance = maintenanceData.filter(
      (m: any) => m.status === "resolved" || m.status === "closed"
    ).length;
    const totalPaid = paymentData
      .filter((p: any) => p.status === "paid")
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const pendingPayments = paymentData.filter(
      (p: any) => p.status === "pending" || p.status === "overdue"
    ).length;

    sendSuccess(res, {
      pendingMaintenance,
      resolvedMaintenance,
      totalPaid,
      pendingPayments,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/user-distribution
 * Get user distribution by role (for admin charts)
 */
export async function getUserDistribution(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [clientsRes, managersRes, tenantsRes] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("managers")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true }),
    ]);

    sendSuccess(res, [
      { name: "Clients", value: clientsRes.count ?? 0 },
      { name: "Tenants", value: tenantsRes.count ?? 0 },
      { name: "Managers", value: managersRes.count ?? 0 },
    ]);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/tenants-per-apartment
 * Get aggregated per-client stats for admin chart (matching frontend getTenantsPerApartment)
 */
export async function getTenantsPerApartment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    // Get all active apartments with tenant counts
    const { data: apartments, error: aptError } = await supabaseAdmin
      .from("units")
      .select("*")
      .eq("status", "active")
      .order("name");

    if (aptError) {
      sendError(res, aptError.message, 500);
      return;
    }

    const { data: tenants, error: tenError } = await supabaseAdmin
      .from("tenants")
      .select("unit_id")
      .eq("status", "active");

    if (tenError) {
      sendError(res, tenError.message, 500);
      return;
    }

    // Count tenants per apartment
    const countMap: Record<string, number> = {};
    (tenants || []).forEach((t: any) => {
      if (t.unit_id) {
        countMap[t.unit_id] = (countMap[t.unit_id] || 0) + 1;
      }
    });

    const apartmentsWithCounts = (apartments || []).map((apt: any) => ({
      ...apt,
      tenant_count: countMap[apt.id] || 0,
    }));

    // Get client names
    const clientIds = [
      ...new Set(
        apartmentsWithCounts
          .map((a: any) => a.client_id)
          .filter(Boolean)
      ),
    ] as string[];

    let clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      (clients || []).forEach((c: any) => {
        clientMap[c.id] = c.name;
      });
    }

    // Get manager counts per client
    let managerCountMap: Record<string, number> = {};
    if (clientIds.length > 0) {
      const { data: managers } = await supabaseAdmin
        .from("managers")
        .select("client_id")
        .eq("status", "active")
        .in("client_id", clientIds);
      (managers || []).forEach((m: any) => {
        if (m.client_id) {
          managerCountMap[m.client_id] =
            (managerCountMap[m.client_id] || 0) + 1;
        }
      });
    }

    // Aggregate per client
    const clientAggMap: Record<
      string,
      {
        owner: string;
        tenants: number;
        units: number;
        apartments: number;
        activeUnits: number;
        addresses: string[];
        managers: number;
      }
    > = {};

    for (const apt of apartmentsWithCounts) {
      const cid = apt.client_id || "__unassigned";
      const ownerName =
        apt.client_id && clientMap[apt.client_id]
          ? clientMap[apt.client_id]
          : "Unassigned";

      if (!clientAggMap[cid]) {
        clientAggMap[cid] = {
          owner: ownerName,
          tenants: 0,
          units: 0,
          apartments: 0,
          activeUnits: 0,
          addresses: [],
          managers: apt.client_id
            ? managerCountMap[apt.client_id] || 0
            : 0,
        };
      }

      clientAggMap[cid].tenants += apt.tenant_count;
      clientAggMap[cid].units += apt.total_units || 0;
      clientAggMap[cid].apartments += 1;
      if (apt.tenant_count > 0) clientAggMap[cid].activeUnits += 1;
      if (
        apt.address &&
        !clientAggMap[cid].addresses.includes(apt.address)
      ) {
        clientAggMap[cid].addresses.push(apt.address);
      }
    }

    const results = Object.entries(clientAggMap).map(([id, c]) => ({
      id,
      name: c.owner.length > 12 ? c.owner.slice(0, 12) : c.owner,
      fullName: c.owner,
      tenants: c.tenants,
      units: c.units,
      apartments: c.apartments,
      activeUnits: c.activeUnits,
      owner: c.owner,
      location: c.addresses.join(", "),
      managers: c.managers,
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/all-users
 * Get all users (clients, managers, tenants) combined for admin user list
 */
export async function getAllUsers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [clientsRes, managersRes, tenantsRes] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("managers")
        .select("*, clients(apartment_address)")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("tenants")
        .select("*, clients(apartment_address)")
        .order("created_at", { ascending: false }),
    ]);

    const users: any[] = [];

    (clientsRes.data || []).forEach((c: any) => {
      users.push({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: "owner",
        status: c.status || "active",
        address: c.apartment_address || null,
        created_at: c.created_at,
      });
    });

    (managersRes.data || []).forEach((m: any) => {
      users.push({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        role: "manager",
        status: m.status || "active",
        address: m.clients?.apartment_address || null,
        created_at: m.created_at,
      });
    });

    (tenantsRes.data || []).forEach((t: any) => {
      users.push({
        id: t.id,
        name: t.name,
        email: t.email || "",
        phone: t.phone,
        role: "tenant",
        status: t.status || "active",
        address: t.clients?.apartment_address || null,
        created_at: t.created_at,
      });
    });

    // Sort by created_at descending
    users.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sendSuccess(res, users);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/maintenance-by-month
 * Get maintenance requests aggregated by month for a client
 */
export async function getMaintenanceByMonth(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const clientId = req.query.client_id as string;

    if (!clientId) {
      sendError(res, "client_id query parameter is required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("maintenance")
      .select("created_at, status")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const monthMap: Record<string, { pending: number; resolved: number }> = {};

    (data || []).forEach((req: any) => {
      const date = new Date(req.created_at);
      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { pending: 0, resolved: 0 };
      if (req.status === "resolved" || req.status === "closed") {
        monthMap[key].resolved++;
      } else {
        monthMap[key].pending++;
      }
    });

    const results = Object.entries(monthMap).map(([month, counts]) => ({
      month,
      pending: counts.pending,
      resolved: counts.resolved,
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
