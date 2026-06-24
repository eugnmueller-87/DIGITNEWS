import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for finalizeCapture's result mapping — specifically that an exact
 * re-capture (startProcessing throws DuplicateImageError) becomes a friendly,
 * non-error result the UI shows as "already posted", while other failures stay
 * a generic error. We mock the server-only capture flow and auth so the action
 * runs without Supabase. DuplicateImageError must come from the SAME mock
 * module the action imports, so `instanceof` matches.
 */

class DuplicateImageError extends Error {
  constructor() {
    super("duplicate_image");
    this.name = "DuplicateImageError";
  }
}

const requireAdmin = vi.fn();
const startProcessing = vi.fn();
const createRawUploadTarget = vi.fn();

vi.mock("@/lib/auth", () => ({ requireAdmin: () => requireAdmin() }));
// The actions now resolve a dictionary for their messages; return the real `de`
// dict directly so they don't pull in cookies()/session in the node test env.
vi.mock("@/lib/i18n/server", async () => {
  const { de } = await import("@/lib/i18n/dictionaries");
  return { getDict: async () => de, getLocale: async () => "de" };
});
vi.mock("@/lib/capture", () => ({
  DuplicateImageError,
  startProcessing: (...a: unknown[]) => startProcessing(...a),
  createRawUploadTarget: (...a: unknown[]) => createRawUploadTarget(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { org_type: "kita" } }),
        }),
      }),
    }),
  }),
}));

const { finalizeCapture } = await import("./actions");

const SESSION = {
  userId: "user-1",
  orgId: "org-1",
  role: "admin" as const,
  email: "a@b.de",
  membershipStatus: "active" as const,
  displayName: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(SESSION);
});

describe("finalizeCapture", () => {
  it("passes the source hash through to startProcessing", async () => {
    startProcessing.mockResolvedValueOnce({ postId: "p1", triggered: true });
    const res = await finalizeCapture("org-1/abc.jpg", "deadbeef");
    expect(res.ok).toBe(true);
    expect(res.triggered).toBe(true);
    expect(startProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: "org-1/abc.jpg",
        sourceHash: "deadbeef",
      }),
    );
  });

  it("threads allowDuplicate through to startProcessing (default false)", async () => {
    startProcessing.mockResolvedValue({ postId: "p1", triggered: true });
    await finalizeCapture("org-1/abc.jpg", "deadbeef");
    expect(startProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ allowDuplicate: false }),
    );

    await finalizeCapture("org-1/abc.jpg", "deadbeef", true);
    expect(startProcessing).toHaveBeenLastCalledWith(
      expect.objectContaining({ allowDuplicate: true }),
    );
  });

  it("maps a duplicate image to a friendly, non-error result", async () => {
    startProcessing.mockRejectedValueOnce(new DuplicateImageError());
    const res = await finalizeCapture("org-1/abc.jpg", "deadbeef");
    expect(res.ok).toBe(false);
    expect(res.duplicate).toBe(true);
    expect(res.message).toMatch(/bereits aufgenommen/i);
  });

  it("maps any other failure to a generic error (not a duplicate)", async () => {
    startProcessing.mockRejectedValueOnce(new Error("boom"));
    const res = await finalizeCapture("org-1/abc.jpg", "deadbeef");
    expect(res.ok).toBe(false);
    expect(res.duplicate).toBeUndefined();
    expect(res.message).toMatch(/nicht gestartet/i);
  });
});
