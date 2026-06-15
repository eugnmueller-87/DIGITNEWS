import { PageHeader, SkeletonCard } from "@/components/ui";
import { getDict } from "@/lib/i18n/server";

/** Instant skeleton while the reflection query resolves. */
export default async function RueckblickLoading() {
  const t = await getDict();
  return (
    <div className="space-y-4">
      <PageHeader title={t.rueckblick.title} subtitle={t.rueckblick.subtitle} />
      <div className="space-y-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}
