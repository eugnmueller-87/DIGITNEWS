import { PageHeader, SkeletonCard } from "@/components/ui";

/** Instant skeleton while the reflection query resolves. */
export default function RueckblickLoading() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Rückblick"
        subtitle="Was die Kinder unter der Woche gemacht haben."
      />
      <div className="space-y-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}
