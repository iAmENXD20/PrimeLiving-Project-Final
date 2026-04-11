import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmailMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../src/config/supabase", () => ({
  supabaseAdmin: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmailMock,
    },
    from: mocks.fromMock,
  },
}));

import { resetPassword, logout, getMe } from "../src/controllers/auth.controller";
import { createAnnouncement } from "../src/controllers/announcements.controller";
import {
  getApartments,
  getApartmentById,
  setPaymentDueDay,
  getApartmentCount,
} from "../src/controllers/apartments.controller";
import { createClient, getClientLocation } from "../src/controllers/clients.controller";
import { uploadDocument } from "../src/controllers/documents.controller";
import { uploadMaintenancePhoto } from "../src/controllers/maintenance.controller";
import {
  getManagers,
  getManagerById,
  getManagerCount,
} from "../src/controllers/managers.controller";
import {
  submitPaymentProof,
  getPayments,
  createPayment,
  verifyPayment,
  getTenantDueSchedule,
  generateMonthlyBillings,
  getPendingVerifications,
  uploadPaymentQr,
  getPaymentQr,
  getPaymentQrByApartment,
  getPaymentQrByTenant,
  deletePaymentQr,
} from "../src/controllers/payments.controller";
import {
  markAllNotificationsRead,
  deleteAllNotifications,
  sendTestSms,
  getSmsConfigStatus,
} from "../src/controllers/notifications.controller";
import { getRevenueByMonth } from "../src/controllers/revenues.controller";
import {
  getManagerStats,
  getMaintenanceByMonth,
} from "../src/controllers/analytics.controller";
import { createTenant } from "../src/controllers/tenants.controller";
import {
  assignTenantToUnit,
  removeTenantFromUnit,
} from "../src/controllers/tenants.controller";
import {
  createMaintenanceRequest,
  updateMaintenanceStatus,
} from "../src/controllers/maintenance.controller";

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json };
}

function makeQueryResult(result: { data?: any; error?: any; count?: number | null }) {
  const query: any = {
    data: result.data,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "gte",
    "lte",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];

  for (const method of chainMethods) {
    query[method] = vi.fn(() => query);
  }

  return query;
}

describe("controller unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auth.resetPassword returns success response", async () => {
    mocks.resetPasswordForEmailMock.mockResolvedValue({ error: null });

    const req = { body: { email: "test@example.com" } } as any;
    const res = makeRes();

    await resetPassword(req, res as any);

    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith("test@example.com");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Password reset email sent" })
    );
  });

  it("auth.logout returns success response", async () => {
    const req = {} as any;
    const res = makeRes();

    await logout(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Logged out successfully" })
    );
  });

  it("auth.getMe returns request user", async () => {
    const req = { user: { id: "u-1", role: "owner" } } as any;
    const res = makeRes();

    await getMe(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ user: expect.objectContaining({ id: "u-1" }) }),
      })
    );
  });

  it("announcements.createAnnouncement returns 500 when insert fails", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "announcements") {
        throw new Error(`unexpected table: ${table}`);
      }

      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: "db failure" } }),
          }),
        }),
      };
    });

    const req = {
      body: {
        apartmentowner_id: "client-1",
        title: "Notice",
        message: "Test",
      },
      user: { email: "owner@example.com", role: "owner" },
    } as any;
    const res = makeRes();

    await createAnnouncement(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "db failure" })
    );
  });

  it("documents.uploadDocument validates required fields", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await uploadDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "apartmentowner_id, file_name, file_type and file_data are required",
      })
    );
  });

  it("clients.createClient validates email", async () => {
    const req = { body: { name: "Owner" } } as any;
    const res = makeRes();

    await createClient(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Email is required" })
    );
  });

  it("clients.getClientLocation requires authentication", async () => {
    const req = { params: { id: "client-1" }, user: null } as any;
    const res = makeRes();

    await getClientLocation(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Authentication required" })
    );
  });

  it("maintenance.uploadMaintenancePhoto validates required fields", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await uploadMaintenancePhoto(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "tenant_id and data_url are required",
      })
    );
  });

  it("tenants.createTenant validates email when auth creation is requested", async () => {
    const req = {
      body: {
        create_auth_account: true,
        name: "Tenant Name",
      },
    } as any;
    const res = makeRes();

    await createTenant(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Email is required when creating a tenant auth account",
      })
    );
  });

  it("payments.submitPaymentProof validates required fields", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await submitPaymentProof(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error:
          "tenant_id, apartmentowner_id, period_from, period_to, and receipt_url are required",
      })
    );
  });

  it("payments.getTenantDueSchedule validates tenantId", async () => {
    const req = { params: {} } as any;
    const res = makeRes();

    await getTenantDueSchedule(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "tenantId is required" })
    );
  });

  it("payments.generateMonthlyBillings validates apartmentowner_id", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await generateMonthlyBillings(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentowner_id is required" })
    );
  });

  it("payments.getPendingVerifications validates apartmentowner_id query", async () => {
    const req = { query: {} } as any;
    const res = makeRes();

    await getPendingVerifications(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentowner_id query parameter is required" })
    );
  });

  it("payments.uploadPaymentQr validates required fields", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await uploadPaymentQr(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentowner_id and data_url are required" })
    );
  });

  it("payments.getPaymentQr validates ownerId", async () => {
    const req = { params: {} } as any;
    const res = makeRes();

    await getPaymentQr(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentownerId is required" })
    );
  });

  it("payments.getPaymentQrByApartment validates apartmentId", async () => {
    const req = { params: {} } as any;
    const res = makeRes();

    await getPaymentQrByApartment(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentId is required" })
    );
  });

  it("payments.getPaymentQrByTenant validates tenantId", async () => {
    const req = { params: {} } as any;
    const res = makeRes();

    await getPaymentQrByTenant(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "tenantId is required" })
    );
  });

  it("payments.deletePaymentQr validates apartmentownerId", async () => {
    const req = { params: {} } as any;
    const res = makeRes();

    await deletePaymentQr(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentownerId is required" })
    );
  });

  it("notifications.markAllNotificationsRead validates recipient identity", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await markAllNotificationsRead(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "recipient_role and recipient_id are required" })
    );
  });

  it("notifications.deleteAllNotifications validates recipient identity", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await deleteAllNotifications(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "recipient_role and recipient_id are required" })
    );
  });

  it("notifications.sendTestSms validates required fields", async () => {
    const req = { body: {} } as any;
    const res = makeRes();

    await sendTestSms(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "phone and message are required" })
    );
  });

  it("notifications.getSmsConfigStatus returns status payload", async () => {
    const req = {} as any;
    const res = makeRes();

    await getSmsConfigStatus(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          sms_enabled: expect.any(Boolean),
          semaphore_api_key_configured: expect.any(Boolean),
        }),
      })
    );
  });

  it("revenues.getRevenueByMonth validates apartmentowner_id query", async () => {
    const req = { query: {} } as any;
    const res = makeRes();

    await getRevenueByMonth(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentowner_id query parameter is required" })
    );
  });

  it("analytics.getManagerStats validates apartmentowner_id query", async () => {
    const req = { params: { managerId: "mgr-1" }, query: {} } as any;
    const res = makeRes();

    await getManagerStats(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentowner_id query parameter is required" })
    );
  });

  it("analytics.getMaintenanceByMonth validates apartmentowner_id query", async () => {
    const req = { query: {} } as any;
    const res = makeRes();

    await getMaintenanceByMonth(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "apartmentowner_id query parameter is required" })
    );
  });

  it("managers.getManagers returns data", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "apartment_managers") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: [{ id: "m-1", name: "Manager" }] });
    });

    const req = { query: {} } as any;
    const res = makeRes();

    await getManagers(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [{ id: "m-1", name: "Manager" }] })
    );
  });

  it("managers.getManagerById maps query error to 404", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "apartment_managers") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: null, error: { message: "not found" } });
    });

    const req = { params: { id: "missing" } } as any;
    const res = makeRes();

    await getManagerById(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "not found" })
    );
  });

  it("managers.getManagerCount returns count payload", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "apartment_managers") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ count: 7 });
    });

    const req = {} as any;
    const res = makeRes();

    await getManagerCount(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { count: 7 } })
    );
  });

  it("apartments.getApartments returns flattened rows", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "units") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({
        data: [
          {
            id: "u-1",
            name: "Unit 1",
            apartment: { address: "Address 1", name: "Property A" },
          },
        ],
      });
    });

    const req = { query: {} } as any;
    const res = makeRes();

    await getApartments(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            id: "u-1",
            address: "Address 1",
            apartment_name: "Property A",
          }),
        ],
      })
    );
  });

  it("apartments.getApartmentById maps query error to 404", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "units") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: null, error: { message: "missing unit" } });
    });

    const req = { params: { id: "missing" } } as any;
    const res = makeRes();

    await getApartmentById(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "missing unit" })
    );
  });

  it("apartments.setPaymentDueDay updates all units by apartmentowner_id", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "units") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ error: null });
    });

    const req = { body: { day: 10, apartmentowner_id: "c-1" }, params: {} } as any;
    const res = makeRes();

    await setPaymentDueDay(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Payment due day updated for all apartments",
      })
    );
  });

  it("apartments.getApartmentCount returns count", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "units") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ count: 11 });
    });

    const req = { query: {} } as any;
    const res = makeRes();

    await getApartmentCount(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { count: 11 } })
    );
  });

  it("tenants.assignTenantToUnit validates start_at format", async () => {
    const req = {
      body: {
        unit_id: "u-1",
        tenant_id: "t-1",
        start_at: "not-a-date",
      },
    } as any;
    const res = makeRes();

    await assignTenantToUnit(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "start_at must be a valid date (YYYY-MM-DD)" })
    );
  });

  it("tenants.removeTenantFromUnit returns success", async () => {
    let callCount = 0;
    let updateQuery: any = null;
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "tenants") throw new Error(`unexpected table: ${table}`);
      callCount += 1;
      if (callCount === 1) {
        return makeQueryResult({ data: [{ id: "t-1", status: "active" }], error: null });
      }
      updateQuery = makeQueryResult({ data: null, error: null });
      return updateQuery;
    });

    const req = { body: { unit_id: "u-1", preserve_account: false } } as any;
    const res = makeRes();

    await removeTenantFromUnit(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Tenant removed from unit successfully" })
    );
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        unit_id: null,
        apartment_id: null,
      })
    );
  });

  it("payments.getPayments returns rows", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "payments") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: [{ id: "p-1" }] });
    });

    const req = { query: {} } as any;
    const res = makeRes();

    await getPayments(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [{ id: "p-1" }] })
    );
  });

  it("payments.createPayment returns 201 on success", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "payments") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: { id: "p-2" } });
    });

    const req = { body: { tenant_id: "t-1", amount: 1000 } } as any;
    const res = makeRes();

    await createPayment(req, res as any);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Payment created successfully" })
    );
  });

  it("payments.verifyPayment returns 404 when payment is missing", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "payments") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: null, error: { message: "not found" } });
    });

    const req = { params: { id: "missing" }, body: { verification_status: "verified" } } as any;
    const res = makeRes();

    await verifyPayment(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Payment not found" })
    );
  });

  it("maintenance.createMaintenanceRequest returns 500 when insert fails", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "maintenance") throw new Error(`unexpected table: ${table}`);
      return makeQueryResult({ data: null, error: { message: "insert failed" } });
    });

    const req = {
      body: {
        tenant_id: "t-1",
        unit_id: "u-1",
        apartmentowner_id: "c-1",
        title: "Leak",
        description: "Kitchen leak",
        priority: "high",
      },
    } as any;
    const res = makeRes();

    await createMaintenanceRequest(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "insert failed" })
    );
  });

  it("maintenance.updateMaintenanceStatus returns success", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "maintenance") {
        return makeQueryResult({ data: { id: "m-1", status: "resolved", tenant_id: null } });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const req = { params: { id: "m-1" }, body: { status: "resolved" } } as any;
    const res = makeRes();

    await updateMaintenanceStatus(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Maintenance status updated successfully" })
    );
  });
});
