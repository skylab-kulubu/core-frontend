import { clubRoleLabel, displayPersonName } from './chrome-role';

describe('clubRoleLabel', () => {
  it('prefers YK over lab membership', () => {
    expect(clubRoleLabel(['/UYELER/YK', '/UYELER/ARGE/WEBLAB'])).toBe('YÖNETİM');
  });

  it('labels DK as denetim', () => {
    expect(clubRoleLabel(['/UYELER/DK'])).toBe('DENETİM');
  });

  it('labels a lab path', () => {
    expect(clubRoleLabel(['/UYELER/ARGE/WEBLAB'])).toBe('WEBLAB');
  });

  it('falls back for empty groups', () => {
    expect(clubRoleLabel([])).toBe('KULLANICI');
  });
});

describe('displayPersonName', () => {
  it('title-cases Turkish names', () => {
    expect(displayPersonName('yusuf', 'açmacı')).toBe('Yusuf Açmacı');
  });

  it('uses username when names are empty', () => {
    expect(displayPersonName('', '', 'yustyy')).toBe('Yustyy');
  });
});
