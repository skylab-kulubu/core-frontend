import { render, screen, waitFor } from '@testing-library/react';
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
