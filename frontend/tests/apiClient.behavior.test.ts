import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
    },
  },
}));

import api, { api as namedApi, clearApiCache } from "../src/lib/apiClient";

describe("apiClient behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearApiCache();

    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
    mocks.refreshSession.mockResolvedValue({
      data: { session: { access_token: "refreshed-token" } },
    });

    (globalThis as any).fetch = vi.fn();
  });

  it("reuses cached GET response within TTL", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { value: 123 } }),
    });

    const first = await namedApi.get<{ value: number }>("/stats", { cacheTtlSeconds: 60 });
    const second = await namedApi.get<{ value: number }>("/stats", { cacheTtlSeconds: 60 });

    expect(first.value).toBe(123);
    expect(second.value).toBe(123);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when skipCache is true", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { value: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { value: 2 } }),
      });

    const first = await namedApi.get<{ value: number }>("/stats", { skipCache: true });
    const second = await namedApi.get<{ value: number }>("/stats", { skipCache: true });

    expect(first.value).toBe(1);
    expect(second.value).toBe(2);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("adds Authorization header when token exists", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    await api.get<{ ok: boolean }>("/secure");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (globalThis.fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-token");
  });

  it("clears GET cache after a POST mutation", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { value: 10 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "new" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { value: 20 } }),
      });

    const beforeMutation = await api.get<{ value: number }>("/resource", { cacheTtlSeconds: 120 });
    await api.post<{ id: string }>("/resource", { name: "x" });
    const afterMutation = await api.get<{ value: number }>("/resource", { cacheTtlSeconds: 120 });

    expect(beforeMutation.value).toBe(10);
    expect(afterMutation.value).toBe(20);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("invalidates related apartments cache after tenants mutation", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [{ id: "u1", tenant_name: "Alice" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { success: true } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [{ id: "u1", tenant_name: null }] }),
      });

    const beforeMutation = await api.get<Array<{ id: string; tenant_name: string | null }>>(
      "/apartments/with-tenants?client_id=abc",
      { cacheTtlSeconds: 120 }
    );

    await api.post("/tenants/remove-from-unit", { unit_id: "u1" });

    const afterMutation = await api.get<Array<{ id: string; tenant_name: string | null }>>(
      "/apartments/with-tenants?client_id=abc",
      { cacheTtlSeconds: 120 }
    );

    expect(beforeMutation[0].tenant_name).toBe("Alice");
    expect(afterMutation[0].tenant_name).toBe(null);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws backend-provided error message", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: "Bad request payload" }),
    });

    await expect(api.get("/broken")).rejects.toThrow("Bad request payload");
  });
});
