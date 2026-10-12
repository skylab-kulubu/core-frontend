import { redirect } from 'next/navigation';

// Files are managed where they are used (an event's İçerik tab, a cover picker); the panel has no media library page
export default function MediaRedirect() {
  redirect('/events');
}
