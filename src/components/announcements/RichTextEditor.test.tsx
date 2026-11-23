import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RichTextEditor, RichTextView } from './RichTextEditor';

describe('RichTextEditor', () => {
  it('opens the body with its toolbar', async () => {
    render(
      <RichTextEditor
        label="İçerik"
        value="<p>Merhaba <strong>kulüp</strong></p>"
        onChange={() => {}}
      />,
    );
    expect(await screen.findByRole('toolbar', { name: 'Biçim' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kalın' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'İçerik' })).toHaveTextContent('Merhaba kulüp'),
    );
  });

  it('says so when a link address is refused, and keeps the field open', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor label="İçerik" value="<p>Merhaba</p>" onChange={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Bağlantı' }));
    await user.type(screen.getByLabelText('Bağlantı adresi'), 'javascript:alert(1){Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu adres bağlanamaz');
    expect(screen.getByLabelText('Bağlantı adresi')).toHaveAttribute('aria-invalid', 'true');
  });

  it('draws only what the schema knows in the preview', async () => {
    const { container } = render(
      <RichTextView
        html={
          '<p onclick="alert(1)">a<script>alert(2)</script><a href="javascript:alert(3)">b</a></p>'
        }
      />,
    );
    await waitFor(() => expect(container).toHaveTextContent('a'));
    expect(container.innerHTML).not.toMatch(/onclick|<script|javascript:/);
  });
});
