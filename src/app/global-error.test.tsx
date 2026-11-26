/** @jest-environment node */

import { renderToStaticMarkup } from 'react-dom/server';
import GlobalError from '@/app/global-error';
import { sceneAction } from '@/test/error-scenes';

describe('GlobalError', () => {
  it('replaces the root layout with its own page and the 500 scene, with a retry', () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error('boom')} reset={() => undefined} />,
    );
    expect(html).toMatch(/^<html lang="tr"/);
    expect(html).toContain('<body');
    expect(html).toMatch(/<h1[^>]*>/);
    expect(html).toContain(`>${sceneAction('error')}<`);
    expect(html).not.toContain('boom');
  });
});
