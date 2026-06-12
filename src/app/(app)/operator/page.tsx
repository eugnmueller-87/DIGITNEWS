import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import type { Org, Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

import { CreateOrgForm } from "./create-org-form";
import { OrgAdmins } from "./org-admins";

export const metadata: Metadata = { title: "Operator" };

/**
 * Operator console (superadmin only). Create orgs + first admin, and manage
 * admin rights per org. Reads are cross-org via the superadmin RLS policies.
 */
export default async function OperatorPage() {
  await requireSuperadmin();
  const supabase = await createClient();

  // Cross-org reads (superadmin RLS). Exclude the operator's own anchor org from
  // the customer list by org_type? No — show all real orgs; the operator org is
  // 'sonstiges' named 'Operator'. We simply list everything and let the operator
  // see it all.
  const [{ data: orgs }, { data: profiles }] = await Promise.all([
    supabase
      .from("orgs")
      .select("id, name, slug, org_type, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, org_id, role, membership_status, display_name"),
  ]);

  const orgList = (orgs ?? []) as Pick<
    Org,
    "id" | "name" | "slug" | "org_type" | "created_at"
  >[];
  const profileList = (profiles ?? []) as Pick<
    Profile,
    "id" | "org_id" | "role" | "membership_status" | "display_name"
  >[];

  const byOrg = new Map<string, typeof profileList>();
  for (const p of profileList) {
    const arr = byOrg.get(p.org_id) ?? [];
    arr.push(p);
    byOrg.set(p.org_id, arr);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Operator</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Organisationen anlegen und Admin-Rechte verwalten.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Neue Organisation
        </h2>
        <CreateOrgForm />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Organisationen ({orgList.length})
        </h2>
        {orgList.map((org) => {
          const people = byOrg.get(org.id) ?? [];
          const memberCount = people.length;
          return (
            <Card key={org.id}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{org.name}</h3>
                <span className="text-xs text-zinc-400">
                  {org.org_type} · {memberCount}{" "}
                  {memberCount === 1 ? "Person" : "Personen"}
                </span>
              </div>
              <OrgAdmins
                people={people.map((p) => ({
                  id: p.id,
                  role: p.role,
                  status: p.membership_status,
                  displayName: p.display_name,
                }))}
              />
            </Card>
          );
        })}
      </section>
    </div>
  );
}
