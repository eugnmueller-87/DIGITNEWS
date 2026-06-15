import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test for the registration OTP verify flow (verifyCode).
 *
 * The action validates email + code, calls supabase.auth.verifyOtp, and on
 * success redirect()s to /set-password. We mock the server Supabase client and
 * next/navigation's redirect (which normally throws a framework control-flow
 * error) so we can assert each branch: bad email, bad code shape, wrong code,
 * and the success redirect.
 */

const verifyOtp = vi.fn();
const redirect = vi.fn((path: string) => {
  // Mimic Next's redirect: throw a sentinel so control flow stops here.
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({ redirect: (p: string) => redirect(p) }));
// verifyCode resolves a dictionary for its messages; return the real `de` dict
// so it doesn't reach cookies()/session in the node test env.
vi.mock("@/lib/i18n/server", async () => {
  const { de } = await import("@/lib/i18n/dictionaries");
  return { getDict: async () => de, getLocale: async () => "de" };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { verifyOtp: (a: unknown) => verifyOtp(a) },
  }),
}));

const { verifyCode } = await import("./actions");

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}
const PREV = { ok: false, message: null };

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
});

describe("verifyCode", () => {
  it("rejects a malformed email without calling verifyOtp", async () => {
    const res = await verifyCode(PREV, fd({ email: "nope", code: "123456" }));
    expect(res.ok).toBe(false);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects a missing / wrong-shaped code", async () => {
    const res = await verifyCode(PREV, fd({ email: "a@b.de", code: "12" }));
    expect(res.ok).toBe(false);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("strips whitespace from the code and calls verifyOtp(type:recovery)", async () => {
    // Success path redirects → our mock throws the sentinel.
    await expect(
      verifyCode(PREV, fd({ email: "a@b.de", code: " 12 34 56 " })),
    ).rejects.toThrow("REDIRECT:/set-password");
    expect(verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.de",
        token: "123456",
        type: "recovery",
      }),
    );
  });

  it("returns a neutral error when the code is invalid/expired", async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: "expired" } });
    const res = await verifyCode(PREV, fd({ email: "a@b.de", code: "123456" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/ungültig|abgelaufen/i);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /set-password on success", async () => {
    await expect(
      verifyCode(PREV, fd({ email: "a@b.de", code: "123456" })),
    ).rejects.toThrow("REDIRECT:/set-password");
  });
});
