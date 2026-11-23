import { redirect } from 'next/navigation';

// Ekipler is the Groups page's Ekipler view now: one list of the club's Groups
export default function TeamsRedirect() {
  redirect('/groups?view=teams');
}
