import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { FaqSection } from './LandingBlocks';

const items = [
  { q: 'Does it cost anything?', a: 'No.' },
  { q: 'Which language can I submit?', a: 'Python for now.' },
  { q: 'How is a contest scored?', a: 'A solved problem is worth 100 points.' },
];

const ask = (question) => screen.getByRole('button', { name: question });
const entry = (question) => ask(question).closest('.faq-i');

describe('FaqSection', () => {
  it('opens on the first question, so the list is never all shut', () => {
    render(<FaqSection items={items} />);

    expect(entry(items[0].q)).toHaveClass('open');
    expect(entry(items[1].q)).not.toHaveClass('open');
  });

  it('closes the open answer when another is asked for', () => {
    render(<FaqSection items={items} />);

    fireEvent.click(ask(items[2].q));

    expect(entry(items[2].q)).toHaveClass('open');
    expect(entry(items[0].q)).not.toHaveClass('open');
  });

  it('shuts the open one when it is asked again', () => {
    render(<FaqSection items={items} />);

    fireEvent.click(ask(items[0].q));

    expect(entry(items[0].q)).not.toHaveClass('open');
  });
});
