import type { Metadata } from "next";

import { CategoryFeed } from "@/app/(app)/bereiche/category-feed";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Infos" };

/** Library of general info notices (content_type='info', incl. unconfirmed). */
export default function InfoPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Infos" subtitle="Allgemeine Mitteilungen." />
      <CategoryFeed
        contentType="info"
        includeNull
        emptyTitle="Noch keine Infos veröffentlicht."
      />
    </div>
  );
}
