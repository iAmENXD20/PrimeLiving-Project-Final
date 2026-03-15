import { describe, expect, it, vi } from "vitest";
import { sendError, sendSuccess, generateRandomPassword } from "../src/utils/helpers";

describe("helpers", () => {
  it("sendSuccess sends standardized response", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as any;

    sendSuccess(res, { ok: true }, "done", 201);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { ok: true },
      message: "done",
    });
  });

  it("sendError sends standardized error response", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as any;

    sendError(res, "bad request", 400);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: "bad request",
    });
  });

  it("generateRandomPassword respects length", () => {
    const password = generateRandomPassword(16);
    expect(password).toHaveLength(16);
  });
});
