import { ProblemError } from '@/lib/api/core';
import type { ManagedGroup } from '@/lib/api/identity';
import {
  leaderKindLabel,
  managedParentOf,
  moveProblemMessage,
  movePreviewRows,
  moveRefusalMessage,
  moveTargets,
  subTeamDeleteMessage,
  teamName,
  teamStructureMessage,
} from '@/lib/sub-teams';

function node(
  id: string,
  path: string,
  can: Record<string, boolean>,
  children: ManagedGroup[] = [],
): ManagedGroup {
  return { id, code: path.split('/').pop()!, path, can, children };
}

const OPENS = { 'subteams.write': true };
// WEBLAB ─┬─ FRONTEND ── UI
//         └─ MOBIL
// ALGOLAB (read only)
const UI = node('ui', '/UYELER/ARGE/WEBLAB/FRONTEND/UI', OPENS);
const FRONTEND = node('fe', '/UYELER/ARGE/WEBLAB/FRONTEND', OPENS, [UI]);
const MOBIL = node('mob', '/UYELER/ARGE/WEBLAB/MOBIL', OPENS);
const WEBLAB = node('web', '/UYELER/ARGE/WEBLAB', OPENS, [FRONTEND, MOBIL]);
const ALGOLAB = node('algo', '/UYELER/ARGE/ALGOLAB', { 'group.read': true });
const TREE = [WEBLAB, ALGOLAB];

describe('teamName', () => {
  it('names a Team by its Turkish display name, else its code', () => {
    expect(teamName({ code: 'WEBLAB', displayName: { tr: ' Web Lab ' } })).toBe('Web Lab');
    expect(teamName({ code: 'WEBLAB', displayName: { tr: ' ', en: 'Web' } })).toBe('WEBLAB');
    expect(teamName({ code: 'WEBLAB' })).toBe('WEBLAB');
  });
});

describe('leaderKindLabel', () => {
  it('words both Leader groups and leaves an unknown one as core sent it', () => {
    expect(leaderKindLabel('LIDERLER')).toBe('Lider');
    expect(leaderKindLabel('KOORDINATORLER')).toBe('Koordinatör');
    expect(leaderKindLabel('X')).toBe('X');
  });
});

describe('managedParentOf', () => {
  it('finds the Team right above, at any depth, and none for a Team the tree starts at', () => {
    expect(managedParentOf(TREE, 'ui')?.id).toBe('fe');
    expect(managedParentOf(TREE, 'mob')?.id).toBe('web');
    expect(managedParentOf(TREE, 'web')).toBeUndefined();
  });
});

describe('moveTargets', () => {
  const ids = (moving: ManagedGroup) => moveTargets(TREE, moving).map(({ group }) => group.id);

  it('offers the Teams core lets the reader open Sub-teams under', () => {
    // Not ALGOLAB: core gives the reader no subteams.write there
    expect(ids(MOBIL)).toEqual(['fe', 'ui']);
  });

  it('leaves out the Team itself, the Teams under it and the Team it sits under', () => {
    expect(ids(FRONTEND)).toEqual(['mob']);
    expect(ids(UI)).toEqual(['web', 'mob']);
  });

  it('keeps how deep each target sits for the list', () => {
    expect(moveTargets(TREE, MOBIL).map(({ depth }) => depth)).toEqual([1, 2]);
  });
});

describe('movePreviewRows', () => {
  const preview = {
    allowed: true,
    oldPath: '/UYELER/ARGE/WEBLAB/MOBIL',
    newPath: '/UYELER/ARGE/WEBLAB/FRONTEND/MOBIL',
    members: 4,
    rolesGained: [],
    rolesLost: [],
    newParentLeaders: 2,
  };

  it('lists the paths, the people and the new parent’s Leaders', () => {
    expect(movePreviewRows(preview)).toEqual([
      { label: 'Şimdiki yol', value: '/UYELER/ARGE/WEBLAB/MOBIL' },
      { label: 'Yeni yol', value: '/UYELER/ARGE/WEBLAB/FRONTEND/MOBIL' },
      { label: 'Taşınan kişi', value: '4' },
      { label: 'Yeni üst ekibin lideri', value: '2' },
    ]);
  });

  it('names the roles gained and lost only when there are some', () => {
    const rows = movePreviewRows({
      ...preview,
      rolesGained: ['forms:skyforms:access', 'skymail:skymail:access'],
      rolesLost: ['core:url:access'],
    });
    expect(rows).toContainEqual({
      label: 'Kazanılan roller',
      value: 'forms:skyforms:access, skymail:skymail:access',
    });
    expect(rows).toContainEqual({ label: 'Kaybedilen roller', value: 'core:url:access' });
  });
});

describe('teamStructureMessage', () => {
  it('words core’s structure refusals', () => {
    expect(
      teamStructureMessage(new ProblemError(422, 'Unprocessable', { code: 'reserved_name' }), 'x'),
    ).toBe('Bu kod ayrılmış; başka bir kod seç.');
    expect(
      teamStructureMessage(
        new ProblemError(403, 'Forbidden', { code: 'team_code_privileged_only' }),
        'x',
      ),
    ).toBe('Ekip kodunu YK değiştirir.');
    expect(
      teamStructureMessage(new ProblemError(409, 'Conflict', { code: 'children_limit' }), 'x'),
    ).toBe('Ekibin alt ekip sınırı dolu.');
  });

  it('names the kinds of record that hold a code', () => {
    expect(
      teamStructureMessage(
        new ProblemError(409, 'Conflict', {
          code: 'code_in_use',
          fields: { records: ['event', 'certificate_template'] },
        }),
        'x',
      ),
    ).toBe('Bu koda bağlı kayıt var (etkinlik, sertifika şablonu); kod değiştirilemez.');
  });

  it('falls back to the panel’s problem text, with the caller’s status words', () => {
    expect(teamStructureMessage(new ProblemError(404, 'Not Found'), 'x', { 404: 'Yok.' })).toBe(
      'Yok.',
    );
    expect(teamStructureMessage(new Error('boom'), 'Atanamadı')).toBe('Atanamadı');
  });
});

describe('subTeamDeleteMessage', () => {
  it('says who is still in the Sub-team, or what is under it', () => {
    expect(
      subTeamDeleteMessage(
        new ProblemError(409, 'Conflict', {
          code: 'not_empty',
          fields: { members: 3, children: 1 },
        }),
      ),
    ).toBe('Alt ekipte ya da altındaki gruplarda 3 kişi var (liderler dahil); önce onları çıkar.');
    expect(
      subTeamDeleteMessage(
        new ProblemError(409, 'Conflict', {
          code: 'not_empty',
          fields: { members: 0, children: 2 },
        }),
      ),
    ).toBe('Alt ekibin altında 2 grup var; önce onları sil.');
  });

  it('names the records that hold a code and keeps the Group delete’s words otherwise', () => {
    expect(
      subTeamDeleteMessage(
        new ProblemError(409, 'Conflict', { code: 'code_in_use', fields: { records: ['event'] } }),
      ),
    ).toBe('Ekibin ya da altındaki bir grubun koduna bağlı kayıt var (etkinlik); silinemez.');
    expect(
      subTeamDeleteMessage(new ProblemError(403, 'Forbidden', { code: 'protected_group' })),
    ).toBe('Bu grup veya üst grubu korunan roller taşıyor; buradan silinemez.');
    expect(
      subTeamDeleteMessage(new ProblemError(503, 'Unavailable', { code: 'audit_unavailable' })),
    ).toBe('Değişiklik kayda yazılamadı, bu yüzden yapılmadı. Biraz sonra tekrar dene.');
  });
});

describe('move refusals', () => {
  it('words the preview’s refusal codes', () => {
    expect(moveRefusalMessage('cycle')).toBe('Ekip kendi altına taşınamaz.');
    expect(moveRefusalMessage('depth_limit')).toBe(
      'Ekip ağacının sınırı aşılırdı: alt ekipler çok derinleşir ya da yol çok uzar.',
    );
    expect(moveRefusalMessage('role_placement')).toMatch(/rolleri kurala aykırı/);
    expect(moveRefusalMessage(undefined)).toBe('Bu taşıma yapılamaz.');
    expect(moveRefusalMessage('something_new')).toBe('Bu taşıma yapılamaz.');
  });

  it('words a refused move as the preview would', () => {
    expect(
      moveProblemMessage(new ProblemError(409, 'Conflict', { code: 'privileged_root' }), 'x'),
    ).toBe('Yönetim kökleri ve altlarındaki gruplar taşınamaz.');
    expect(
      moveProblemMessage(new ProblemError(403, 'Forbidden', { code: 'protected_group' }), 'x'),
    ).toBe('Korunan ekip: yalnız YK değiştirir.');
  });
});
