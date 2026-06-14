import type { Metadata } from "next";

import { CategoryFeed } from "@/app/(app)/bereiche/category-feed";
import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Infos" };

/** Library of general info notices (content_type='info', incl. unconfirmed). */
export default function InfoPage() {
  return (
    <div className="space-y-4">
      <MarkSeen category="info" />
      <PageHeader title="Infos" subtitle="Allgemeine Mitteilungen." />
      <CategoryFeed
        contentType="info"
        includeNull
        emptyTitle="Noch keine Infos veröffentlicht."
      />
    </div>
  );
}
