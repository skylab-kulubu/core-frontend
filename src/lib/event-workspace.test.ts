import {
  eventTabFromAnchor,
  eventTabFromPath,
  eventTabHref,
  legacyEventAnchorHref,
} from '@/lib/event-workspace';

describe('event workspace routes', () => {
  it('gives each tab its own route under the event, the overview on the event itself', () => {
    expect(eventTabHref('e1')).toBe('/events/e1');
    expect(eventTabHref('e1', 'overview')).toBe('/events/e1');
    expect(eventTabHref('e1', 'participants')).toBe('/events/e1/participants');
    expect(eventTabHref('e1', 'program')).toBe('/events/e1/program');
    expect(eventTabHref('e1', 'certificates')).toBe('/events/e1/certificates');
    expect(eventTabHref('e1', 'content')).toBe('/events/e1/content');
    expect(eventTabHref('e1', 'competition')).toBe('/events/e1/competition');
    expect(eventTabHref('a b', 'program')).toBe('/events/a%20b/program');
  });

  it('reads the open tab from the path', () => {
    expect(eventTabFromPath('/events/e1')).toBe('overview');
    expect(eventTabFromPath('/events/e1/')).toBe('overview');
    expect(eventTabFromPath('/events/e1/participants')).toBe('participants');
    expect(eventTabFromPath('/events/e1/competition')).toBe('competition');
    expect(eventTabFromPath('/events/e1/tickets/t1')).toBeNull();
    expect(eventTabFromPath('/events/e1/unknown')).toBeNull();
    expect(eventTabFromPath('/events')).toBeNull();
    expect(eventTabFromPath('/events/new')).toBeNull();
  });

  it('maps the old in-page anchors to their tabs', () => {
    expect(eventTabFromAnchor('#overview')).toBe('overview');
    expect(eventTabFromAnchor('#participants')).toBe('participants');
    expect(eventTabFromAnchor('#program')).toBe('program');
    expect(eventTabFromAnchor('#files')).toBe('content');
    expect(eventTabFromAnchor('#competitors')).toBe('competition');
    expect(eventTabFromAnchor('#certificates')).toBe('certificates');
    expect(eventTabFromAnchor('program')).toBe('program');
    expect(eventTabFromAnchor('')).toBeNull();
    expect(eventTabFromAnchor('#nope')).toBeNull();
  });

  it('sends an old anchor link to its tab, and leaves the overview where it is', () => {
    expect(legacyEventAnchorHref('e1', '#participants')).toBe('/events/e1/participants');
    expect(legacyEventAnchorHref('e1', '#files')).toBe('/events/e1/content');
    expect(legacyEventAnchorHref('e1', '#overview')).toBeNull();
    expect(legacyEventAnchorHref('e1', '')).toBeNull();
    expect(legacyEventAnchorHref('e1', '#nope')).toBeNull();
  });
});
