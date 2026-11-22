import '@testing-library/jest-dom';
import { MotionGlobalConfig } from 'motion/react';
import { clearCoreReads } from '@/lib/api/core-read-cache';
import { forgetAccessToken } from '@/lib/auth/access-token';

// React asks for this flag before it lets state updates run through act(). Testing
// Library sets it only from its main entry point; rtl.tsx imports the '/pure'
// one (to render inside the app's providers), which leaves it unset
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Animations finish at once in tests; skylcn-ui's motion is checked in its own repo
MotionGlobalConfig.skipAnimations = true;
MotionGlobalConfig.instantAnimations = true;

// jsdom lacks these browser APIs that skylcn-ui's shell and palette use
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}

// The page keeps the access token and core's recent answers in memory; each test starts without
afterEach(() => {
  forgetAccessToken();
  clearCoreReads();
});
