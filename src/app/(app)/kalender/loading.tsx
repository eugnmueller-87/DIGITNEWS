import { Skeleton, SkeletonCard } from "@/components/ui";

/** Instant skeleton while the calendar's confirmed-events query resolves. */
export default function KalenderLoading() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-3">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>
    </div>
  );
}
