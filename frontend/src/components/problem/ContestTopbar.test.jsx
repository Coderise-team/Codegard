import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ContestTopbar from './ContestTopbar';

// The user menu pulls in the auth store and router navigation — not the subject
// here, so it stands in as a marker.
vi.mock('../layout/UserMenu', () => ({
  default: () => <div data-testid="user-menu" />,
}));

const iso = (ms) => new Date(Date.now() + ms).toISOString();

const contest = (over = {}) => ({
  id: 7,
  title: 'Codegard Cup #40',
  start_time: iso(-3600e3),
  end_time: iso(3600e3),
  problems: [
    { id: 11, title: 'Two Sum' },
    { id: 12, title: 'Brackets' },
    { id: 13, title: 'Cactus' },
  ],
  ...over,
});

const renderBar = (props) =>
  render(
    <MemoryRouter>
      <ContestTopbar
        contest={contest()}
        currentLetter="B"
        now={Date.now()}
        user={{ username: 'me', initials: 'ME' }}
        statuses={{ 11: 'solved', 12: 'attempted' }}
        showLeaderboard={false}
        onToggleLeaderboard={() => {}}
        onMenuClick={() => {}}
        {...props}
      />
    </MemoryRouter>
  );

describe('ContestTopbar', () => {
  it('draws a pip per problem, carries the status dot and lights the active one', () => {
    const { container } = renderBar();

    const pips = container.querySelectorAll('.ct-pip');
    expect(pips).toHaveLength(3);
    // status comes in keyed by problem id, defaulting to "open"
    expect(container.querySelector('.ct-pip.s-solved')).toBeTruthy();
    expect(container.querySelector('.ct-pip.s-attempted')).toBeTruthy();
    // the letter on screen (B) is the current pip and links to its round letter
    const current = container.querySelector('.ct-pip.current');
    expect(current.textContent).toContain('B');
    expect(current.getAttribute('href')).toBe('/contests/7/problems/B');
  });

  it('counts down a live round', () => {
    const { container } = renderBar();

    expect(container.querySelector('.ct-timer-lbl').textContent).toBe(
      'Ends in'
    );
    expect(container.querySelector('.ct-timer-pulse')).toBeTruthy();
    expect(container.querySelector('.ct-timer.done')).toBeNull();
  });

  it('reads Finished once the round is over', () => {
    const { container } = renderBar({
      contest: contest({ start_time: iso(-7200e3), end_time: iso(-3600e3) }),
    });

    expect(container.querySelector('.ct-timer.done')).toBeTruthy();
    expect(container.querySelector('.ct-timer-val').textContent).toBe(
      'Finished'
    );
    // the pulse stops on a finished round
    expect(container.querySelector('.ct-timer-pulse')).toBeNull();
  });

  it('reflects and toggles the leaderboard rail', () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(
      <MemoryRouter>
        <ContestTopbar
          contest={contest()}
          currentLetter="A"
          now={Date.now()}
          user={{ username: 'me' }}
          statuses={{}}
          showLeaderboard={false}
          onToggleLeaderboard={onToggle}
          onMenuClick={() => {}}
        />
      </MemoryRouter>
    );

    const toggle = container.querySelector('.ct-lb-toggle');
    expect(toggle.classList.contains('is-on')).toBe(false);
    expect(toggle.textContent).toContain('Show leaderboard');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <ContestTopbar
          contest={contest()}
          currentLetter="A"
          now={Date.now()}
          user={{ username: 'me' }}
          statuses={{}}
          showLeaderboard
          onToggleLeaderboard={onToggle}
          onMenuClick={() => {}}
        />
      </MemoryRouter>
    );
    const onNow = container.querySelector('.ct-lb-toggle');
    expect(onNow.classList.contains('is-on')).toBe(true);
    expect(onNow.textContent).toContain('Hide leaderboard');
  });

  it('links back to the round and opens the drawer', () => {
    const onMenuClick = vi.fn();
    const { container } = renderBar({ onMenuClick });

    expect(container.querySelector('.ct-back').getAttribute('href')).toBe(
      '/contests/7'
    );
    expect(container.querySelector('.ct-back-title').textContent).toBe(
      'Codegard Cup #40'
    );

    fireEvent.click(container.querySelector('.icon-btn'));
    expect(onMenuClick).toHaveBeenCalled();
  });
});
