import { activeStatus, statusChip, ticketCheckInStatus, ticketTypeStatus } from './status-chip';

describe('statusChip', () => {
  it('labels active and passive with glowing dots', () => {
    expect(statusChip('active')).toEqual({
      label: 'Aktif',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
      dotClassName: 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/40',
    });
    expect(statusChip('passive').label).toBe('Pasif');
    expect(statusChip('passive').dotClassName).toContain('bg-red-400');
  });

  it('maps ticket type and check-in to guest/member and amber/emerald', () => {
    expect(ticketTypeStatus('GUEST')).toBe('guest');
    expect(ticketTypeStatus('REGISTERED')).toBe('member');
    expect(statusChip('guest').label).toBe('Misafir');
    expect(statusChip('member').label).toBe('Üye');
    expect(ticketCheckInStatus(true)).toBe('checked-in');
    expect(ticketCheckInStatus(false)).toBe('pending');
    expect(statusChip('checked-in').label).toBe('Giriş yaptı');
    expect(statusChip('pending').label).toBe('Kayıtlı');
  });

  it('marks featured and winner as brand and success chips', () => {
    expect(statusChip('featured').label).toBe('Öne çıkan');
    expect(statusChip('featured').className).toContain('skylab');
    expect(statusChip('winner').label).toBe('Kazanan');
    expect(activeStatus(true)).toBe('active');
    expect(activeStatus(false)).toBe('passive');
  });
});
