import type { Metadata } from "next";

import { CategoryFeed } from "@/app/(app)/bereiche/category-feed";
import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Gesundheit" };

/** Library of health notices (content_type='health_notice'). */
export default function GesundheitPage() {
  return (
    <div className="space-y-4">
      <MarkSeen category="health_notice" />
      <PageHeader
        title="Gesundheit"
        subtitle="Hinweise zu Krankheiten und Gesundheit."
      />
      <CategoryFeed
        contentType="health_notice"
        emptyTitle="Keine aktuellen Gesundheitshinweise."
      />
    </div>
  );
}
