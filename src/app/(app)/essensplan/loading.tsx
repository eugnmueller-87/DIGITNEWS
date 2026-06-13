import { PageHeader, SkeletonCard } from "@/components/ui";

/** Instant skeleton while the meal-plan query resolves. */
export default function EssensplanLoading() {
  return (
    <div className="space-y-4">
      <PageHeader title="Essensplan" subtitle="Was die Kinder essen." />
      <div className="space-y-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}
