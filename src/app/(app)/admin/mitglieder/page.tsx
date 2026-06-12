import type { Metadata } from "next";

import { joinCodeQrSvg, applyUrl } from "@/lib/applications";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

import { AddPersonForm } from "./add-person-form";
import { ApplicationRow } from "./application-row";
import { JoinCodePanel } from "./join-code-panel";
import { MemberRow } from "./member-row";

export const metadata: Metadata = { title: "Mitglieder" };

/**
 * Admin members view: add a person (email + role), and the current member list
 * with remove controls. Reads are RLS-governed — an org admin sees only their
 * own org's profiles. The admin route layout already guaranteed admin-or-above.
 */
export default async function MitgliederPage() {
  const session = await requireAdmin();
  const supabase = await createClient();

  const [{ data: members }, { data: codes }, { data: apps }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, membership_status, display_name, created_at")
        .eq("org_id", session.orgId)
        .order("created_at", { ascending: true }),
      // The org's active (non-revoked) join code, if any.
      supabase
        .from("join_codes")
        .select("code, label")
        .eq("org_id", session.orgId)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(1),
      // Applications awaiting a decision: verified ones the admin should action,
      // plus pending ones (not yet email-verified) shown as "awaiting email".
      supabase
        .from("applications")
        .select(
          "id, email, parent_name, child_group, child_name, status, created_at",
        )
        .eq("org_id", session.orgId)
        .in("status", ["verified", "pending"])
        .order("created_at", { ascending: true }),
    ]);

  const memberList = (members ?? []) as Pick<
    Profile,
    "id" | "role" | "membership_status" | "display_name" | "created_at"
  >[];

  const code = (codes ?? [])[0] as
    | { code: string; label: string | null }
    | undefined;
  const qrSvg = code ? await joinCodeQrSvg(code.code) : null;
  const codeUrl = code ? applyUrl(code.code) : null;

  type AppRow = {
    id: string;
    email: string;
    parent_name: string | null;
    child_group: string | null;
    child_name: string | null;
    status: "pending" | "verified";
    created_at: string;
  };
  const applications = (apps ?? []) as AppRow[];
  const verifiedApps = applications.filter((a) => a.status === "verified");
  const pendingApps = applications.filter((a) => a.status === "pending");

  const canAddAdmins = session.role === "superadmin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mitglieder</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Füge Personen per E-Mail hinzu. Sie bekommen einen Login-Link.
        </p>
      </div>

      <AddPersonForm canAddAdmins={canAddAdmins} />

      {/* QR self-apply: code + QR for parents to scan, and the approval queue. */}
      <JoinCodePanel hasCode={!!code} qrSvg={qrSvg} url={codeUrl} />

      {(verifiedApps.length > 0 || pendingApps.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Anfragen{verifiedApps.length > 0 && ` (${verifiedApps.length})`}
          </h2>
          <div className="space-y-2">
            {verifiedApps.map((a) => (
              <ApplicationRow
                key={a.id}
                id={a.id}
                email={a.email}
                parentName={a.parent_name}
                childName={a.child_name}
                group={a.child_group}
                awaitingEmail={false}
              />
            ))}
            {pendingApps.map((a) => (
              <ApplicationRow
                key={a.id}
                id={a.id}
                email={a.email}
                parentName={a.parent_name}
                childName={a.child_name}
                group={a.child_group}
                awaitingEmail={true}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Mitglieder ({memberList.length})
        </h2>
        <div className="space-y-2">
          {memberList.map((m) => (
            <MemberRow
              key={m.id}
              id={m.id}
              role={m.role}
              status={m.membership_status}
              displayName={m.display_name}
              isSelf={m.id === session.userId}
              // An org admin can remove members; a superadmin can also remove
              // admins. Never offer removal of the current user or a superadmin.
              canRemove={
                m.id !== session.userId &&
                m.role !== "superadmin" &&
                (m.role === "member" || session.role === "superadmin")
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
