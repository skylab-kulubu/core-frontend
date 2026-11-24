import { config } from 'zod';

// Runs in the browser before the app. zod tries `Function('')` to see whether it may compile its
// parsers; the panel's CSP allows no eval, so it would only fall back after a CSP report. Its
// interpreted parsers from the start.
config({ jitless: true });
