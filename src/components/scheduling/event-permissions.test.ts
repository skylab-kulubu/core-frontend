import {
  withTeamCapabilities,
  type EventPermissions,
} from '@/components/scheduling/EventWorkspace';

const ALL: EventPermissions = {
  canMutate: true,
  canDelete: true,
  canCompetitors: true,
  canTickets: true,
  canAssign: true,
  canDesk: true,
  canCertificates: true,
  canReadIssuedCertificates: true,
  canIssueCertificate: true,
  canBindCertificate: true,
  canRevokeCertificate: true,
};

describe('withTeamCapabilities', () => {
  it('takes every write from a DK member and keeps what core lets read', () => {
    const reads = new Set(['ticket.read', 'certificate.read']);
    const can = withTeamCapabilities(ALL, 'WEBLAB', (_, key) => reads.has(key), false);
    expect(can).toEqual({
      ...ALL,
      canMutate: false,
      canDelete: false,
      canCompetitors: false,
      canAssign: false,
      canDesk: false,
      canIssueCertificate: false,
      canBindCertificate: false,
      canRevokeCertificate: false,
    });
  });

  it('asks core for the event Owner team and keeps the door open to its staff', () => {
    const asked: string[] = [];
    const can = withTeamCapabilities(
      ALL,
      'WEBLAB',
      (team, key) => {
        asked.push(`${team}:${key}`);
        return key === 'event.update';
      },
      true,
    );
    expect(can.canMutate).toBe(true);
    expect(can.canDelete).toBe(false);
    expect(can.canDesk).toBe(true);
    expect(asked.every((row) => row.startsWith('WEBLAB:'))).toBe(true);
  });

  it('follows core where the group rule cannot see: a Leader of the Team above (ticket 12)', () => {
    const none = Object.fromEntries(
      Object.keys(ALL).map((key) => [key, false]),
    ) as EventPermissions;
    expect(withTeamCapabilities(none, 'MOBIL', () => true, false)).toEqual(ALL);
  });

  it('passes each group rule as the stand-in when core cannot be read', () => {
    const some = { ...ALL, canDelete: false, canAssign: false, canRevokeCertificate: false };
    const groupRule = (_team: string, _key: string, rule: boolean) => rule;
    expect(withTeamCapabilities(some, 'WEBLAB', groupRule, false)).toEqual(some);
  });
});
