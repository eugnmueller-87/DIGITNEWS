import { PageHeader, SkeletonCard } from "@/components/ui";

/** Instant skeleton while the feed's RLS-scoped queries resolve. */
export default function FeedLoading() {
  return (
    <div className="space-y-4">
      <PageHeader title="Pinnwand" subtitle="Neuigkeiten deiner Einrichtung." />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
