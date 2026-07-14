import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import ErrorBoundary from './ErrorBoundary';

function Boom() {
  throw new Error('kaboom');
}

const renderCrash = () => {
  const router = createMemoryRouter(
    [
      {
        errorElement: <ErrorBoundary />,
        children: [{ path: '/', element: <Boom /> }],
      },
    ],
    { initialEntries: ['/'] }
  );
  return render(<RouterProvider router={router} />);
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React and the router both log the caught error; the crash is the point.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('catches a crashing route instead of leaving a blank screen', () => {
    renderCrash();

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('surfaces the error message in dev only', () => {
    renderCrash();

    // Vitest runs with DEV on, so the detail block is there; the production
    // bundle drops it and users never see internals.
    expect(import.meta.env.DEV).toBe(true);
    expect(screen.getByText('kaboom')).toBeInTheDocument();
  });
});
