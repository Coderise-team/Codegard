import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { useSearchTerm } from './useSearchTerm';

function Harness() {
  const [term, setTerm] = useSearchTerm();
  const { search } = useLocation();

  return (
    <>
      <span data-testid="term">{term}</span>
      <span data-testid="address">{search}</span>
      <button onClick={() => setTerm('arrays')}>set</button>
      <button onClick={() => setTerm('')}>clear</button>
      <button onClick={() => setTerm('  ')}>spaces</button>
      <button onClick={() => setTerm('two ')}>half a phrase</button>
    </>
  );
}

const renderAt = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
    </MemoryRouter>
  );

const term = () => screen.getByTestId('term').textContent;
const address = () => screen.getByTestId('address').textContent;

describe('useSearchTerm', () => {
  it('reads the term a link arrived with', () => {
    renderAt('/problems?search=arrays');

    expect(term()).toBe('arrays');
  });

  it('is empty when the address carries no search', () => {
    renderAt('/problems');

    expect(term()).toBe('');
  });

  it('writes the term into the address', () => {
    renderAt('/problems');

    fireEvent.click(screen.getByText('set'));

    expect(address()).toBe('?search=arrays');
    expect(term()).toBe('arrays');
  });

  it('drops the parameter instead of leaving an empty one behind', () => {
    renderAt('/problems?search=arrays');

    fireEvent.click(screen.getByText('clear'));

    expect(address()).toBe('');
    expect(term()).toBe('');
  });

  it('treats a term of nothing but spaces as no search at all', () => {
    // The server strips it and answers with the whole list, so a page must not
    // act as if a search were running.
    renderAt('/problems');

    fireEvent.click(screen.getByText('spaces'));

    expect(address()).toBe('');
    expect(term()).toBe('');
  });

  it('keeps a space inside a term', () => {
    renderAt('/problems');

    fireEvent.click(screen.getByText('half a phrase'));

    expect(term()).toBe('two ');
  });

  it('keeps the other filters in the address', () => {
    renderAt('/problems?tag=arrays&tag=hashing');

    fireEvent.click(screen.getByText('set'));

    expect(address()).toBe('?tag=arrays&tag=hashing&search=arrays');
  });
});
