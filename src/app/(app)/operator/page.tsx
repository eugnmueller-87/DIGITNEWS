import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import type { Org, Profile } from "@/lib/database.types";
import { fmt } from "@/lib/i18n/format";
import { getDict } from "@/lib/i18n/server";
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
  const t = await getDict();
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
        <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
          {t.operator.title}
        </h1>
        <p className="text-[15px] text-ink-soft">{t.operator.subtitle}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-base font-bold text-ink">
          {t.operator.newOrg}
        </h2>
        <CreateOrgForm />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-bold text-ink">
          {fmt(t.operator.orgs, { count: orgList.length })}
        </h2>
        {orgList.map((org) => {
          const people = byOrg.get(org.id) ?? [];
          const memberCount = people.length;
          return (
            <Card key={org.id}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold text-ink">{org.name}</h3>
                <span className="text-sm text-ink-soft">
                  {org.org_type} · {memberCount}{" "}
                  {memberCount === 1 ? t.operator.person : t.operator.persons}
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
