import { act, render, screen } from '@testing-library/react';
import { GlobalErrorMessenger } from '@/components/common/GlobalErrorMessenger';
import { ProblemError } from '@/lib/api/core';

function rejectUnhandled(reason: unknown) {
  const event = new Event('unhandledrejection');
  Object.assign(event, { reason });
  window.dispatchEvent(event);
}

describe('GlobalErrorMessenger', () => {
  it("says an unhandled core refusal in Turkish, never core's English title or detail", () => {
    render(<GlobalErrorMessenger />);
    act(() =>
      rejectUnhandled(
        new ProblemError(403, 'Forbidden', { detail: 'missing role core:events:write' }),
      ),
    );

    expect(screen.getByText('Beklenmeyen bir hata oluştu')).toBeInTheDocument();
    expect(screen.getByText(/Bu işlem için yetkin yok\./)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Forbidden|missing role/);
  });
});
