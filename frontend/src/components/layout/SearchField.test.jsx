import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import SearchField from './SearchField';

const field = () => screen.getByPlaceholderText('Search problems…');
const type = (value) => fireEvent.change(field(), { target: { value } });
const wait = (ms) => act(() => vi.advanceTimersByTime(ms));

describe('SearchField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands the page a term only once typing stops', () => {
    const onChange = vi.fn();
    render(
      <SearchField
        placeholder="Search problems…"
        value=""
        onChange={onChange}
      />
    );

    type('ar');
    wait(200);
    type('arr');
    wait(299);
    expect(onChange).not.toHaveBeenCalled();

    wait(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('arr');
  });

  it('clears without making anyone wait for it', () => {
    const onChange = vi.fn();
    render(
      <SearchField
        placeholder="Search problems…"
        value=""
        onChange={onChange}
      />
    );

    type('arr');
    fireEvent.click(screen.getByTitle('Clear'));

    expect(onChange).toHaveBeenCalledWith('');
    expect(field()).toHaveValue('');
  });

  it('escape empties the field and steps out of it', () => {
    const onChange = vi.fn();
    render(
      <SearchField
        placeholder="Search problems…"
        value=""
        onChange={onChange}
      />
    );

    type('arr');
    fireEvent.keyDown(field(), { key: 'Escape' });

    expect(field()).toHaveValue('');
    expect(field()).not.toHaveFocus();
  });

  it('carries the term on enter for a page that searches nothing itself', () => {
    const onSubmit = vi.fn();
    render(<SearchField placeholder="Search problems…" onSubmit={onSubmit} />);

    type('arrays');
    wait(1000);
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('arrays');
  });

  it('follows a term that changed without it', () => {
    const { rerender } = render(
      <SearchField placeholder="Search problems…" value="arr" onChange={noop} />
    );

    rerender(
      <SearchField
        placeholder="Search problems…"
        value="sums"
        onChange={noop}
      />
    );

    expect(field()).toHaveValue('sums');
  });

  describe('the slash shortcut', () => {
    it('jumps into the field from the page', () => {
      render(
        <SearchField placeholder="Search problems…" value="" onChange={noop} />
      );

      fireEvent.keyDown(document.body, { key: '/' });

      expect(field()).toHaveFocus();
    });

    it('leaves a slash typed into another field alone', () => {
      render(
        <>
          <input aria-label="elsewhere" />
          <SearchField
            placeholder="Search problems…"
            value=""
            onChange={noop}
          />
        </>
      );
      const elsewhere = screen.getByLabelText('elsewhere');

      fireEvent.keyDown(elsewhere, { key: '/' });

      expect(field()).not.toHaveFocus();
    });
  });

  it('unfolds from its button and folds back once it loses focus', () => {
    const { container } = render(
      <SearchField placeholder="Search problems…" value="" onChange={noop} />
    );
    const box = container.querySelector('.gsearch');

    fireEvent.click(screen.getByTitle('Search'));
    expect(box.className).toContain('is-open');

    fireEvent.blur(field());
    expect(box.className).not.toContain('is-open');
  });
});

function noop() {}
