/**
 * The panel's type scale on top of skylcn-ui's: body text 14px (`text-sm`), secondary text
 * 13px, 12px (`text-xs`) only for badges and meta. skylcn-ui has no 13px step yet, so it is an
 * arbitrary value here; written out in full so Tailwind sees it and `cn` keeps it as a size,
 * not a colour (a named `text-*` utility it does not know would drop the colour class).
 */
export const TEXT_SECONDARY = 'text-[13px]/5';

/** A labelled button's text: 13px, 14px on touch screens (skylcn-ui's sizes write 11px/12px). */
export const BUTTON_TEXT = 'text-[13px] pointer-coarse:text-sm';
