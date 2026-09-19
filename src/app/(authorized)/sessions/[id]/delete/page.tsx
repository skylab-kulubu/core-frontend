import { redirect } from 'next/navigation';

export default function DeleteSessionRedirect() {
  redirect('/events');
}
