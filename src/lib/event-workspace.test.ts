import { editorReturnTo } from '@/lib/event-draft';
import { APPLY_SLOT_KEY } from '@/lib/event-forms';
import {
  eventCertificateTemplateHref,
  eventDoorStaffHref,
  eventPageFromPath,
  eventRegistrationSettingsHref,
  eventSettingsHref,
  eventTabFromAnchor,
  eventTabFromPath,
  eventTabHref,
  isFocusPath,
  legacyEditHref,
  legacyEventAnchorHref,
  showsCompetitionTab,
} from '@/lib/event-workspace';

describe('event workspace routes', () => {
  it('draws the door and the certificate template editor without the sidebar', () => {
    expect(isFocusPath('/events/e1/door')).toBe(true);
    expect(eventCertificateTemplateHref('e1')).toBe('/events/e1/certificate-template');
    expect(isFocusPath('/events/e1/certificate-template')).toBe(true);
    expect(isFocusPath('/events/e1/certificates')).toBe(false);
    expect(isFocusPath('/certificates/templates/t1')).toBe(false);
  });

  it('gives each tab its own route under the event, the overview on the event itself', () => {
    expect(eventTabHref('e1')).toBe('/events/e1');
    expect(eventTabHref('e1', 'overview')).toBe('/events/e1');
    expect(eventTabHref('e1', 'participants')).toBe('/events/e1/participants');
    expect(eventTabHref('e1', 'program')).toBe('/events/e1/program');
    expect(eventTabHref('e1', 'certificates')).toBe('/events/e1/certificates');
    expect(eventTabHref('e1', 'content')).toBe('/events/e1/content');
    expect(eventTabHref('e1', 'competition')).toBe('/events/e1/competition');
    expect(eventTabHref('e1', 'checkin')).toBe('/events/e1/checkin');
    expect(eventTabHref('e1', 'emails')).toBe('/events/e1/emails');
    expect(eventTabHref('a b', 'program')).toBe('/events/a%20b/program');
  });

  it('keeps the event’s own settings under /settings, a tab’s beside it', () => {
    expect(eventSettingsHref('e1')).toBe('/events/e1/settings/general');
    expect(eventSettingsHref('e1', 'visibility')).toBe('/events/e1/settings/visibility');
    expect(eventRegistrationSettingsHref('e1')).toBe('/events/e1/participants/settings');
    // The door staff are chosen on Kapı; the scanning page keeps its address
    expect(eventDoorStaffHref('e1')).toBe('/events/e1/checkin#kapi-gorevlileri');
    expect(isFocusPath('/events/e1/checkin')).toBe(false);
  });

  it('reads the open page, a tab’s settings or an event setting, from the path', () => {
    expect(eventPageFromPath('/events/e1/checkin')).toEqual({ kind: 'tab', tab: 'checkin' });
    expect(eventPageFromPath('/events/e1/participants/settings')).toEqual({
      kind: 'tab',
      tab: 'participants',
      registrationSettings: true,
    });
    expect(eventPageFromPath('/events/e1/settings/team')).toEqual({
      kind: 'settings',
      page: 'team',
    });
    expect(eventPageFromPath('/events/e1/settings/nope')).toBeNull();
    expect(eventPageFromPath('/events/e1/program/x')).toBeNull();
    expect(eventPageFromPath('/events/e1/edit')).toBeNull();
    expect(eventTabFromPath('/events/e1/participants/settings')).toBeNull();
    expect(eventTabFromPath('/events/e1/settings/general')).toBeNull();
  });

  it('sends the old Düzenle page’s sections where their settings went', () => {
    expect(legacyEditHref('e1')).toBe('/events/e1/settings/general');
    expect(legacyEditHref('e1', '#nope')).toBe('/events/e1/settings/general');
    expect(legacyEditHref('e1', '#basvuru')).toBe('/events/e1/participants/settings#kayit-formu');
    expect(legacyEditHref('e1', 'kapi-gorevlileri')).toBe('/events/e1/checkin#kapi-gorevlileri');
    expect(legacyEditHref('e1', '#sertifika')).toBe('/events/e1/certificates');
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

  it('brings Skyforms back to the event itself from whichever tab opened the editor', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(
      editorReturnTo(`https://admin.yildizskylab.com/events/${id}/program`, APPLY_SLOT_KEY),
    ).toBe(`https://admin.yildizskylab.com/events/${id}?formSlot=apply`);
    expect(
      editorReturnTo(`https://admin.yildizskylab.com/events/${id}/participants`, 'extra-ctf'),
    ).toBe(`https://admin.yildizskylab.com/events/${id}?formSlot=extra-ctf`);
  });

  it('shows Yarışma to competitor managers, and to everyone once there are competitors', () => {
    expect(showsCompetitionTab(true, 0)).toBe(true);
    expect(showsCompetitionTab(false, 2)).toBe(true);
    expect(showsCompetitionTab(false, 0)).toBe(false);
  });
});
