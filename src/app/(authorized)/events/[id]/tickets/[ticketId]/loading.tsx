import { PageSkeleton } from '@/components/chrome/PageSkeleton';

/** The same outline the ticket page shows while it reads, so one skeleton, not two in a row. */
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
