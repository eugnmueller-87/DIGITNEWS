import type { Metadata } from "next";

import { CategoryFeed } from "@/app/(app)/bereiche/category-feed";
import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { PageHeader } from "@/components/ui";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Infos" };

/** Library of general info notices (content_type='info', incl. unconfirmed). */
export default async function InfoPage() {
  const t = await getDict();
  return (
    <div className="space-y-4">
      <MarkSeen category="info" />
      <PageHeader title={t.info.title} subtitle={t.info.subtitle} />
      <CategoryFeed contentType="info" includeNull emptyTitle={t.info.empty} />
    </div>
  );
}
