import type { Metadata } from "next";

import { CategoryFeed } from "@/app/(app)/bereiche/category-feed";
import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { PageHeader } from "@/components/ui";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Gesundheit" };

/** Library of health notices (content_type='health_notice'). */
export default async function GesundheitPage() {
  const t = await getDict();
  return (
    <div className="space-y-4">
      <MarkSeen category="health_notice" />
      <PageHeader title={t.gesundheit.title} subtitle={t.gesundheit.subtitle} />
      <CategoryFeed
        contentType="health_notice"
        emptyTitle={t.gesundheit.empty}
      />
    </div>
  );
}
