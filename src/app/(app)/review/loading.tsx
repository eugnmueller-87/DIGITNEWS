import { SkeletonCard } from "@/components/ui";

/** Instant skeleton while the review queue (drafts awaiting approval) loads. */
export default function ReviewLoading() {
  return (
    <div className="space-y-4">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  );
}
