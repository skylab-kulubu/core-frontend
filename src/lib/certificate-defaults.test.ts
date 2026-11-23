import { defaultLabels, defaultRows, eventUses } from './certificate-defaults';

const bindings = [
  { id: '1', scope: 'ownerTeam' as const, scopeKey: 'WEBLAB', templateId: 't', updatedAt: '' },
  { id: '2', scope: 'club' as const, scopeKey: 'SKY_LAB', templateId: 't', updatedAt: '' },
  { id: '3', scope: 'event' as const, scopeKey: 'e1', templateId: 't', updatedAt: '' },
];

describe('certificate defaults', () => {
  it('names a template’s defaults, the club first', () => {
    expect(defaultLabels('t', bindings)).toEqual(['Kulüp varsayılanı', 'WEBLAB varsayılanı']);
    expect(defaultLabels('x', bindings)).toEqual([]);
    expect(eventUses('t', bindings)).toBe(1);
  });

  it('lists the club, then the teams in order, each with its binding', () => {
    const rows = defaultRows(['WEBLAB', 'GECEKODU'], bindings, true);
    expect(rows.map((row) => row.key)).toEqual(['club', 'GECEKODU', 'WEBLAB']);
    expect(rows[0].binding?.id).toBe('2');
    expect(rows[1].binding).toBeUndefined();
    expect(rows[2].binding?.id).toBe('1');
    expect(defaultRows(['WEBLAB'], bindings, false).map((row) => row.key)).toEqual(['WEBLAB']);
  });
});
