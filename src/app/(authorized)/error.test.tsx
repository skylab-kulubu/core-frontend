import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AuthorizedError from '@/app/(authorized)/error';
import { sceneAction, sceneTitle } from '@/test/error-scenes';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('route error', () => {
  it('logs the error and retries from the server', async () => {
    const pointer = userEvent.setup();
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = jest.fn();
    const error = new Error('boom');
    render(<AuthorizedError error={error} reset={reset} />);
    expect(screen.getByRole('heading', { name: sceneTitle('error') })).toBeInTheDocument();
    expect(log).toHaveBeenCalledWith(error);
    await pointer.click(screen.getByRole('button', { name: sceneAction('error') }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
