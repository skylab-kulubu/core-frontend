import { ErrorScenePage } from '@skylab-kulubu/skylcn-ui';

/** Not found outside the panel's chrome (signed out, or before the chrome): the club's 404 scene. */
export default function NotFound() {
  return <ErrorScenePage kind="notFound" href="/dashboard" />;
}
