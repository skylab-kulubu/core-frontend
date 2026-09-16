import { redirect } from 'next/navigation';

export default function NewSeasonRedirect() {
  redirect('/seasons');
}
