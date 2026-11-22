import { PageSkeleton } from '@/components/chrome/PageSkeleton';

/** An event's pages open with its header and tabs in outline. */
export default function Loading() {
  return <PageSkeleton variant="workspace" />;
}
