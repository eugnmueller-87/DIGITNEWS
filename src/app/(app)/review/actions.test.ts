import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test for the publish write-path (publishDraft / discardDraft).
 *
 * The action pulls in `server-only` modules (auth, the service-role admin
 * client, push, email) and the public-env loader. We mock those direct
 * dependencies so the test exercises the action's OWN logic — input validation,
 * the cross-org ownership guard, the publish_post RPC, and cache revalidation —
 * without a live Supabase or real env.
 */

const requireAdmin = vi.fn();
const revalidatePath = vi.fn();
const pushToOrg = vi.fn().mockResolvedValue(undefined);
const sendEmail = vi.fn().mockResolvedValue(undefined);

let postRow: { id: string; org_id: string; status: string } | null;
let publishError: { message: string } | null;
const rpc = vi.fn();

vi.mock("@/lib/auth", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));
vi.mock("@/lib/push", () => ({
  pushToOrg: (...a: unknown[]) => pushToOrg(...a),
}));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));
vi.mock("@/lib/email/templates", () => ({
  publishNotificationEmail: () => ({ subject: "s", html: "h", text: "t" }),
}));
vi.mock("@/lib/env", () => ({ publicEnv: { siteUrl: "https://test.local" } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "posts" ? { data: postRow } : { data: null },
          eq: () => ({ then: undefined, data: [] }),
        }),
      }),
    }),
    rpc: (name: string, args: unknown) => rpc(name, args),
    auth: { admin: { listUsers: async () => ({ data: { users: [] } }) } },
  }),
}));

const { publishDraft, discardDraft } = await import("./actions");

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const SESSION = {
  userId: "user-1",
  orgId: "org-1",
  role: "admin" as const,
  email: "a@b.de",
  membershipStatus: "active" as const,
  displayName: null,
};
const PREV = { ok: false, message: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(SESSION);
  postRow = { id: "post-1", org_id: "org-1", status: "draft" };
  publishError = null;
  rpc.mockImplementation(async () => ({ error: publishError }));
});

describe("publishDraft", () => {
  it("rejects an invalid content type", async () => {
    const res = await publishDraft(
      PREV,
      fd({ postId: "post-1", contentType: "bogus", title: "T" }),
    );
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty title", async () => {
    const res = await publishDraft(
      PREV,
      fd({ postId: "post-1", contentType: "info", title: "   " }),
    );
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a draft belonging to another org (cross-org guard)", async () => {
    postRow = { id: "post-1", org_id: "OTHER-org", status: "draft" };
    const res = await publishDraft(
      PREV,
      fd({ postId: "post-1", contentType: "info", title: "T" }),
    );
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Entwurf nicht gefunden.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing draft", async () => {
    postRow = null;
    const res = await publishDraft(
      PREV,
      fd({ postId: "nope", contentType: "info", title: "T" }),
    );
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("publishes a valid own-org draft and revalidates feed + review", async () => {
    const res = await publishDraft(
      PREV,
      fd({
        postId: "post-1",
        contentType: "event_notice",
        title: "Sommerfest",
        body: "Am See",
      }),
    );
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "publish_post",
      expect.objectContaining({
        p_actor_id: "user-1",
        p_post_id: "post-1",
        p_content_type: "event_notice",
        p_title: "Sommerfest",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/feed");
    expect(revalidatePath).toHaveBeenCalledWith("/review");
  });

  it("reports failure and does not revalidate when publish_post errors", async () => {
    publishError = { message: "boom" };
    const res = await publishDraft(
      PREV,
      fd({ postId: "post-1", contentType: "info", title: "T" }),
    );
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("truncates an over-long title to 120 chars before publishing", async () => {
    await publishDraft(
      PREV,
      fd({
        postId: "post-1",
        contentType: "info",
        title: "  " + "x".repeat(200) + "  ",
      }),
    );
    const [, args] = rpc.mock.calls[0] as [string, { p_title: string }];
    expect(args.p_title.length).toBe(120);
  });

  it("does not fail the publish when notifications throw (best-effort)", async () => {
    pushToOrg.mockRejectedValueOnce(new Error("push down"));
    const res = await publishDraft(
      PREV,
      fd({ postId: "post-1", contentType: "info", title: "T" }),
    );
    expect(res.ok).toBe(true);
  });
});

describe("discardDraft", () => {
  it("discards an own-org draft", async () => {
    const res = await discardDraft("post-1");
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "discard_post",
      expect.objectContaining({ p_post_id: "post-1" }),
    );
  });

  it("refuses a cross-org draft", async () => {
    postRow = { id: "post-1", org_id: "OTHER", status: "draft" };
    const res = await discardDraft("post-1");
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
