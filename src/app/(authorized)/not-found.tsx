import { ErrorScenePage } from '@skylab-kulubu/skylcn-ui';
import { SearchButton } from '@/components/chrome/PageState';

/** A missing page inside the chrome: the 404 scene, back to Özet, or search. */
export default function AuthorizedNotFound() {
  return (
    <ErrorScenePage kind="notFound" href="/dashboard" as="div">
      <SearchButton />
    </ErrorScenePage>
  );
}
