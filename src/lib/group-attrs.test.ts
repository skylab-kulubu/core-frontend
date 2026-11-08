import {
  buildGroupAttrs,
  competitionManagers,
  extraGroupAttrs,
  isKnownGroupAttr,
  isToggleOn,
} from './group-attrs';

describe('group attributes', () => {
  it('reads public listing as a toggle, not a typed key', () => {
    expect(isToggleOn({ public_listing: 'true' }, 'public_listing')).toBe(true);
    expect(isToggleOn({}, 'public_listing')).toBe(false);
  });

  it('treats description_en as a known field, not an extra key', () => {
    expect(isKnownGroupAttr('description_en')).toBe(true);
    expect(isKnownGroupAttr('slack_channel')).toBe(false);
  });

  it('reads who manages the Competitions as core does: members only on true', () => {
    expect(competitionManagers(undefined)).toBe('leaders');
    expect(competitionManagers({})).toBe('leaders');
    expect(competitionManagers({ team_competition_manage: 'false' })).toBe('leaders');
    expect(competitionManagers({ team_competition_manage: 'yes' })).toBe('leaders');
    expect(competitionManagers({ team_competition_manage: 'true' })).toBe('members');
    expect(competitionManagers({ team_competition_manage: ' TRUE ' })).toBe('members');
  });

  it('knows both Team settings as attributes set elsewhere', () => {
    expect(isKnownGroupAttr('members_manage_competitors')).toBe(true);
    expect(isKnownGroupAttr('team_competition_manage')).toBe(true);
  });

  it('keeps unknown keys as extras', () => {
    expect(
      extraGroupAttrs({
        public_listing: 'true',
        description_en: 'Web lab',
        slack_channel: '#weblab',
      }),
    ).toEqual({ slack_channel: '#weblab' });
  });

  it('omits off toggles and empty texts so unset stays hidden', () => {
    expect(
      buildGroupAttrs({
        toggles: {
          public_listing: true,
          public_leaders: false,
          team_door_scan: false,
        },
        texts: {
          display_name_tr: 'Web Laboratuvarı',
          display_name_en: '',
          description_tr: '',
          description_en: '',
        },
        extra: { slack_channel: '#weblab' },
      }),
    ).toEqual({
      public_listing: 'true',
      display_name_tr: 'Web Laboratuvarı',
      slack_channel: '#weblab',
    });
  });
});
