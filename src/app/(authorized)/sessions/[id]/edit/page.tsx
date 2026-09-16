import { redirect } from 'next/navigation';

export default function EditSessionRedirect() {
  redirect('/sessions');
}
