import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { JoinRequestRow } from "./join-request-row";
import { InviteCodeCard } from "./invite-code-card";
import type { JoinRequest, Profile, Invite } from "@/lib/database.types";

export const metadata: Metadata = { title: "Mitglieder" };

/**
 * Admin members view: the active invite code (to share), the pending join-request
 * queue, and the current member list. All reads are RLS-governed via the
 * user-session client — an admin sees ONLY their own org. The admin route layout
 * already guaranteed the caller is an admin.
 */
export default async function MitgliederPage() {
  const session = await requireAdmin();
  const supabase = await createClient();

  const [{ data: requests }, { data: members }, { data: invites }] =
    await Promise.all([
      supabase
        .from("join_requests")
        .select("id, email, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, role, display_name, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("invites")
        .select("id, code, requires_approval, use_count, max_uses")
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

  const pending = (requests ?? []) as Pick<
    JoinRequest,
    "id" | "email" | "status" | "created_at"
  >[];
  const memberList = (members ?? []) as Pick<
    Profile,
    "id" | "role" | "display_name" | "created_at"
  >[];
  const invite = ((invites ?? [])[0] ?? null) as Pick<
    Invite,
    "id" | "code" | "requires_approval" | "use_count" | "max_uses"
  > | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mitglieder</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Lade Mitglieder ein und gib Beitritts-Anfragen frei.
        </p>
      </div>

      {invite && <InviteCodeCard code={invite.code} />}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Offene Anfragen{pending.length > 0 && ` (${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-400">Keine offenen Anfragen.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <JoinRequestRow key={r.id} id={r.id} email={r.email} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Mitglieder ({memberList.length})
        </h2>
        <Card>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {memberList.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  {m.display_name ?? "—"}
                  {m.id === session.userId && (
                    <span className="ml-2 text-xs text-zinc-400">(du)</span>
                  )}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {m.role === "admin" ? "Admin" : "Mitglied"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
