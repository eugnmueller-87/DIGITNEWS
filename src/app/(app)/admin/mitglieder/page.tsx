import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

import { AddPersonForm } from "./add-person-form";
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

  const { data: members } = await supabase
    .from("profiles")
    .select("id, role, membership_status, display_name, created_at")
    .eq("org_id", session.orgId)
    .order("created_at", { ascending: true });

  const memberList = (members ?? []) as Pick<
    Profile,
    "id" | "role" | "membership_status" | "display_name" | "created_at"
  >[];

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
