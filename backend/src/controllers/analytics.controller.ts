import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";

/**
 * GET /api/analytics/overview
 * Get overall system stats (admin dashboard)
 */
export async function getOverviewStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [ownersRes, managersRes, tenantsRes, apartmentsRes] =
      await Promise.all([
        supabaseAdmin
          .from("apartment_owners")
          .select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("apartment_managers")
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
      ]);

    const totalUsers =
      (ownersRes.count ?? 0) +
      (managersRes.count ?? 0) +
      (tenantsRes.count ?? 0);

    sendSuccess(res, {
      owners: ownersRes.count ?? 0,
      managers: managersRes.count ?? 0,
      tenants: tenantsRes.count ?? 0,
      apartments: apartmentsRes.count ?? 0,
      totalUsers,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/owner/:apartmentownerId
 * Get owner-specific stats
 */
export async function getOwnerStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentownerId } = req.params;
    const monthParam = Number(req.query.month);
    const yearParam = Number(req.query.year);
    const hasMonthFilter =
      Number.isInteger(monthParam) &&
      Number.isInteger(yearParam) &&
      monthParam >= 1 &&
      monthParam <= 12 &&
      yearParam >= 2000;

    // Get apartment IDs for this owner first
    const { data: apartments } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("apartmentowner_id", apartmentownerId);

    const aptIds = (apartments || []).map((a: any) => a.id);

    const revenueQuery = supabaseAdmin
      .from("payments")
      .select("amount, payment_date")
      .eq("apartmentowner_id", apartmentownerId)
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
        .eq("apartmentowner_id", apartmentownerId)
        .eq("status", "active"),
      supabaseAdmin
        .from("maintenance")
        .select("*", { count: "exact", head: true })
        .eq("apartmentowner_id", apartmentownerId)
        .eq("status", "pending"),
      revenueQuery,
    ]);

    // Count active tenants in the owner's apartments
    let activeTenants = 0;
    if (aptIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .in("unit_id", aptIds)
        .eq("status", "active");
      activeTenants = count ?? 0;
    }

    // Fallback: if unit-based query returned 0, try direct apartmentowner_id lookup
    if (activeTenants === 0) {
      const { count } = await supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .eq("apartmentowner_id", apartmentownerId)
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
 * GET /api/analytics/owner/:apartmentownerId/detail-stats
 * Get detailed breakdown of tenants/managers for admin owner detail view
 */
export async function getOwnerDetailStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentownerId } = req.params;

    // Get apartments for this owner
    const { data: apartments } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("apartmentowner_id", apartmentownerId);

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
      .from("apartment_managers")
      .select("id, status")
      .eq("apartmentowner_id", apartmentownerId);

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
 * Get manager-specific dashboard stats (scoped to manager's assigned apartment branch)
 */
export async function getManagerStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { managerId } = req.params;

    // Scope everything to this manager's assigned apartments/units
    const { apartmentIds, unitIds } = await getManagerScope(managerId);

    if (unitIds.length === 0) {
      sendSuccess(res, {
        managedApartments: 0,
        activeTenants: 0,
        pendingMaintenance: 0,
        totalMaintenance: 0,
        paidTenants: 0,
        unpaidTenants: 0,
      });
      return;
    }

    const [tenants, pendingMaintenance, allMaintenance] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .in("unit_id", unitIds)
        .eq("status", "active"),
      supabaseAdmin
        .from("maintenance")
        .select("*", { count: "exact", head: true })
        .in("unit_id", unitIds)
        .eq("status", "pending"),
      supabaseAdmin
        .from("maintenance")
        .select("*", { count: "exact", head: true })
        .in("unit_id", unitIds),
    ]);

    const totalActiveTenants = tenants.count ?? 0;

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
      .in("unit_id", unitIds)
      .eq("status", "paid")
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth);

    const paidTenantIds = new Set(
      (paidPayments || [])
        .map((p: any) => p.tenant_id)
        .filter(Boolean)
    );
    const paidTenants = paidTenantIds.size;
    const unpaidTenants = Math.max(0, totalActiveTenants - paidTenants);

    sendSuccess(res, {
      managedApartments: unitIds.length,
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
    const [ownersRes, managersRes, tenantsRes] = await Promise.all([
      supabaseAdmin
        .from("apartment_owners")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("apartment_managers")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact", head: true }),
    ]);

    sendSuccess(res, [
      { name: "Apartment Owners", value: ownersRes.count ?? 0 },
      { name: "Tenants", value: tenantsRes.count ?? 0 },
      { name: "Apartment Managers", value: managersRes.count ?? 0 },
    ]);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/analytics/tenants-per-apartment
 * Get aggregated per-owner stats for admin chart (matching frontend getTenantsPerApartment)
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

    // Get owner names
    const apartmentownerIds = [
      ...new Set(
        apartmentsWithCounts
          .map((a: any) => a.apartmentowner_id)
          .filter(Boolean)
      ),
    ] as string[];

    let ownerMap: Record<string, string> = {};
    if (apartmentownerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
        .from("apartment_owners")
        .select("id, first_name, last_name")
        .in("id", apartmentownerIds);
      (owners || []).forEach((c: any) => {
        ownerMap[c.id] = `${c.first_name} ${c.last_name}`.trim();
      });
    }

    // Get manager counts per owner
    let managerCountMap: Record<string, number> = {};
    if (apartmentownerIds.length > 0) {
      const { data: managers } = await supabaseAdmin
        .from("apartment_managers")
        .select("apartmentowner_id")
        .eq("status", "active")
        .in("apartmentowner_id", apartmentownerIds);
      (managers || []).forEach((m: any) => {
        if (m.apartmentowner_id) {
          managerCountMap[m.apartmentowner_id] =
            (managerCountMap[m.apartmentowner_id] || 0) + 1;
        }
      });
    }

    // Aggregate per owner
    const ownerAggMap: Record<
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
      const cid = apt.apartmentowner_id || "__unassigned";
      const ownerName =
        apt.apartmentowner_id && ownerMap[apt.apartmentowner_id]
          ? ownerMap[apt.apartmentowner_id]
          : "Unassigned";

      if (!ownerAggMap[cid]) {
        ownerAggMap[cid] = {
          owner: ownerName,
          tenants: 0,
          units: 0,
          apartments: 0,
          activeUnits: 0,
          addresses: [],
          managers: apt.apartmentowner_id
            ? managerCountMap[apt.apartmentowner_id] || 0
            : 0,
        };
      }

      ownerAggMap[cid].tenants += apt.tenant_count;
      ownerAggMap[cid].units += apt.total_units || 0;
      ownerAggMap[cid].apartments += 1;
      if (apt.tenant_count > 0) ownerAggMap[cid].activeUnits += 1;
      if (
        apt.address &&
        !ownerAggMap[cid].addresses.includes(apt.address)
      ) {
        ownerAggMap[cid].addresses.push(apt.address);
      }
    }

    const results = Object.entries(ownerAggMap).map(([id, c]) => ({
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
 * Get all users (owners, managers, tenants) combined for admin user list
 */
export async function getAllUsers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [ownersRes, managersRes, tenantsRes] = await Promise.all([
      supabaseAdmin
        .from("apartment_owners")
        .select("*, apartments(address)")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("apartment_managers")
        .select("*, apartments(address)")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("tenants")
        .select("*, apartments(address)")
        .order("created_at", { ascending: false }),
    ]);

    const users: any[] = [];

    (ownersRes.data || []).forEach((c: any) => {
      const addr = Array.isArray(c.apartments) ? c.apartments[0]?.address : c.apartments?.address;
      users.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        email: c.email,
        phone: c.phone,
        role: "owner",
        status: c.status || "active",
        address: addr || null,
        created_at: c.created_at,
      });
    });

    (managersRes.data || []).forEach((m: any) => {
      users.push({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`.trim(),
        email: m.email,
        phone: m.phone,
        role: "manager",
        status: m.status || "active",
        address: m.apartments?.address || null,
        created_at: m.created_at,
      });
    });

    (tenantsRes.data || []).forEach((t: any) => {
      users.push({
        id: t.id,
        name: `${t.first_name} ${t.last_name}`.trim(),
        email: t.email || "",
        phone: t.phone,
        role: "tenant",
        status: t.status || "active",
        address: t.apartments?.address || null,
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
 * Get maintenance requests aggregated by month for an owner
 */
export async function getMaintenanceByMonth(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentownerId = req.query.apartmentowner_id as string;

    if (!apartmentownerId) {
      sendError(res, "apartmentowner_id query parameter is required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("maintenance")
      .select("created_at, status")
      .eq("apartmentowner_id", apartmentownerId)
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
