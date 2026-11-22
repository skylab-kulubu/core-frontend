import { SkeletonLines } from '@/components/chrome/PageSkeleton';

/** Moving between an event's tabs keeps its header; only the tab's content is outlined. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Yükleniyor</span>
      <SkeletonLines count={4} />
    </div>
  );
}
