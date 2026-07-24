import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('sends the footer card to the signed-in user profile', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar
          user={{ username: 'n3ptune', initials: 'N3' }}
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    expect(container.querySelector('.nav-mini').getAttribute('href')).toBe(
      '/users/n3ptune'
    );
  });
});
