import { PageSkeleton } from '@/components/chrome/PageSkeleton';

/** The door has no event header or tabs: its own outline, not the event's. */
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
