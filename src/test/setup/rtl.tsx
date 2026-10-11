// Testing Library with the app's providers around every render, so skylcn-ui's
// motion and texts behave as they do in the app. Tests import '@testing-library/react'
// as usual; jest maps it here.
import { SkylcnProvider, TooltipProvider } from '@skylab-kulubu/skylcn-ui';
import { cleanup, render as baseRender, type RenderOptions } from '@testing-library/react/pure';
import type { ReactElement, ReactNode } from 'react';

export * from '@testing-library/react/pure';

afterEach(cleanup);

function Providers({ children }: { children: ReactNode }) {
  return (
    <SkylcnProvider locale="tr">
      <TooltipProvider>{children}</TooltipProvider>
    </SkylcnProvider>
  );
}

export function render(ui: ReactElement, options?: RenderOptions) {
  return baseRender(ui, { wrapper: Providers, ...options });
}
