# The point picker's map files

Served from the panel's own origin so the browser asks no third party for
them (core docs/event-map.md, "The panel's map").

- `fonts/`: Noto Sans Regular, Medium and Italic glyphs, ranges 0–255 and
  256–511 (Latin and Latin Extended-A: Turkish letters). SIL Open Font
  License (`fonts/OFL.txt`).
- `sprites/`: the "grayscale" sprite of the Protomaps basemap, v4.
- Both from protomaps/basemaps-assets at
  `028c18f713baecad011301ff7a69acc39bcc2ae7`. Another range a label needs
  (Greek, Cyrillic, Arabic…) is not here: that label is left out.
- `maplibre-gl-worker.mjs` is copied from `maplibre-gl` by
  `scripts/copy-map-worker.mjs` before `next dev` and `next build`; it is not
  committed.
