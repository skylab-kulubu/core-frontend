import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { ExpiredTermsBanner } from '@/components/layout/ExpiredTermsBanner';
import { capabilitiesApi } from '@/lib/api/capabilities';

jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));

const expired = (groupPath: string) => ({
  termId: `t-${groupPath}`,
  groupId: 'g',
  groupPath,
  role: 'board',
  endsAt: '2027-06-30T20:59:59Z',
  expiredAt: '2027-07-01T06:00:00Z',
});

describe('ExpiredTermsBanner', () => {
  it('names the person’s expired memberships and links Dönem devri when they may see it', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.read': true },
      expiredManagementMemberships: [expired('/UYELER/YK'), expired('/UYELER/YK/BASKAN')],
    });
    render(<ExpiredTermsBanner />);
    expect(
      await screen.findByText('2 yönetim üyeliğinin süresi doldu: /UYELER/YK, /UYELER/YK/BASKAN'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dönem devri' })).toHaveAttribute(
      'href',
      '/management-memberships',
    );
  });

  it('shows the strip without a link to a holder who may not see the terms', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: {},
      expiredManagementMemberships: [expired('/UYELER/ARGE/WEBLAB/LIDERLER')],
    });
    render(<ExpiredTermsBanner />);
    expect(
      await screen.findByText('Yönetim üyeliğinin süresi doldu: /UYELER/ARGE/WEBLAB/LIDERLER'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows nothing without expired memberships', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ expiredManagementMemberships: [] });
    const { container } = render(<ExpiredTermsBanner />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
