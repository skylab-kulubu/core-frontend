import { ProblemError } from '@/lib/api/core';
import {
  isCoOrganizerView,
  organizersLine,
  organizersProblemMessage,
  organizerTeamsChip,
  personExpiry,
  personExpiryLine,
} from '@/lib/event-organizers';
import { auditActionLabel } from '@/lib/group-page';
import { copySkippedLines } from '@/lib/event-copy';
import { teamStructureMessage } from '@/lib/sub-teams';

describe('Co-organizers in the panel', () => {
  it('ends a person’s rights 30 days after the Event, or its start plus a day', () => {
    expect(personExpiry({ endDate: '2026-12-12T18:00:00Z' })?.toISOString()).toBe(
      '2027-01-11T18:00:00.000Z',
    );
    expect(personExpiry({ startDate: '2026-12-10T09:00:00Z' })?.toISOString()).toBe(
      '2027-01-10T09:00:00.000Z',
    );
    expect(personExpiry({})).toBeNull();
    expect(personExpiryLine(null)).toBe('Etkinlik bitiminden 30 gün sonra düşer');
    expect(personExpiryLine('2027-01-11T18:00:00Z')).toMatch(
      /^Etkinlik bitiminden 30 gün sonra düşer · 11 Oca 2027$/,
    );
  });

  it('names the refused row and says each reason in Turkish', () => {
    const invalid = (field: string, index: number, reason: string) =>
      new ProblemError(400, 'Bad Request', {
        code: 'event_organizers_invalid',
        fields: { field, index, reason },
      });
    const name = (field: 'teams' | 'people', index: number) =>
      field === 'teams' ? ['WEBLAB', 'YK'][index] : ['Ada Lovelace'][index];

    expect(organizersProblemMessage(invalid('teams', 1, 'privileged_team'), name)).toBe(
      'YK: YK, DK ve ADMIN ortak düzenleyen olamaz.',
    );
    expect(organizersProblemMessage(invalid('people', 0, 'inactive_person'), name)).toBe(
      'Ada Lovelace: Hesabı etkin olmayan kişi eklenemez.',
    );
    expect(
      organizersProblemMessage(
        new ProblemError(400, 'Bad Request', {
          code: 'event_organizers_invalid',
          fields: { field: 'teams', reason: 'too_many' },
        }),
        name,
      ),
    ).toBe('En çok 10 ekip ve 10 kişi eklenir.');
    expect(organizersProblemMessage(new ProblemError(403, 'Forbidden'))).toBe(
      'Düzenleyenleri yalnız sahip ekibin liderleri değiştirir.',
    );
  });

  it('writes the overview line from what the reader may see', () => {
    expect(
      organizersLine({
        ownerTeam: 'YK',
        coOrganizers: [
          { code: 'WEBLAB', management: 'leaders', visibility: 'co_organizer' },
          { code: 'ARTLAB', management: 'members', visibility: 'helper' },
        ],
        coOrganizerIds: ['u1'],
      }),
    ).toBe('YK · Ortak: WEBLAB · Yardımcı: ARTLAB · +1 kişi');
    // A reader who may not edit gets the named teams alone
    expect(organizersLine({ ownerTeam: 'YK', coOrganizerTeams: ['WEBLAB'] })).toBe(
      'YK · Ortak: WEBLAB',
    );
    expect(organizersLine({ ownerTeam: 'GECEKODU' })).toBe('GECEKODU');
  });

  it('chips the list row and marks an Event managed as a Co-organizer', () => {
    expect(organizerTeamsChip({ ownerTeam: 'YK', coOrganizerTeams: ['WEBLAB', 'ARTLAB'] })).toBe(
      'YK + 2 ekip',
    );
    expect(organizerTeamsChip({ ownerTeam: '' })).toBe('Genel');
    expect(isCoOrganizerView({ viewer: { via: 'coTeam', can: {} } })).toBe(true);
    expect(isCoOrganizerView({ viewer: { via: 'coPerson', can: {} } })).toBe(true);
    expect(isCoOrganizerView({ viewer: { via: 'owner', can: {} } })).toBe(false);
    expect(isCoOrganizerView({})).toBe(false);
  });

  it('words the audit rows, the code-in-use record and the copy’s left-out people', () => {
    expect(auditActionLabel('co_organizer.add')).toBe('Ortak düzenleyen eklendi');
    expect(auditActionLabel('co_organizer.remove')).toBe('Ortak düzenleyen çıkarıldı');
    expect(auditActionLabel('co_organizer.change')).toBe('Ortak düzenleyen ayarı değişti');
    expect(
      teamStructureMessage(
        new ProblemError(409, 'Conflict', {
          code: 'code_in_use',
          fields: { records: ['event_co_organizer'] },
        }),
        'x',
      ),
    ).toBe('Bu koda bağlı kayıt var (etkinlik ortak düzenleyeni); kod değiştirilemez.');
    expect(copySkippedLines(['coOrganizerPeople'])).toEqual([
      'Ortak kişiler kopyalanmadı: ortak düzenleyen listesini değiştirme yetkin yok.',
    ]);
  });
});
