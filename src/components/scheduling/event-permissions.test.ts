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
  it('takes every write from a DK member and keeps every read', () => {
    const can = withTeamCapabilities(ALL, 'WEBLAB', () => false, false);
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

  it('never widens the group rule', () => {
    const none = Object.fromEntries(
      Object.keys(ALL).map((key) => [key, false]),
    ) as EventPermissions;
    expect(withTeamCapabilities(none, 'WEBLAB', () => true, false)).toEqual(none);
  });
});
