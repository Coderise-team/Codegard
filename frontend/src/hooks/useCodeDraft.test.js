import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCodeDraft } from './useCodeDraft';
import {
  draftSlot,
  readDraft,
  writeDraft,
  readLanguage,
  writeLanguage,
} from '../utils/codeDrafts';

const SLOT = draftSlot('alice', 5, 3);
const LANGS = [
  { id: 'python', name: 'Python', template: 'py-template' },
  { id: 'javascript', name: 'JavaScript', template: 'js-template' },
];

const sub = (id, language, code) => ({ id, language, code });

const mount = (submissions = []) =>
  renderHook(({ subs }) => useCodeDraft(SLOT, LANGS, subs), {
    initialProps: { subs: submissions },
  });

beforeEach(() => {
  localStorage.clear();
});

describe('useCodeDraft', () => {
  describe.each([
    ['the remembered one', 'javascript', [sub(1, 'python', 'x')], 'javascript'],
    [
      'the latest submission one',
      null,
      [sub(1, 'javascript', 'x')],
      'javascript',
    ],
    ['the first offered one', null, [], 'python'],
    ['past a remembered one no longer offered', 'cobol', [], 'python'],
    [
      'past a submission no longer offered',
      null,
      [sub(1, 'cobol', 'x')],
      'python',
    ],
  ])('starts with %s', (_, remembered, submissions, expected) => {
    it(`picks ${expected}`, () => {
      if (remembered) writeLanguage(SLOT, remembered);

      const { result } = mount(submissions);

      expect(result.current.language).toBe(expected);
    });
  });

  describe.each([
    ['the saved draft', 'draft', [sub(1, 'python', 'submitted')], 'draft'],
    [
      'the latest submission in that language',
      null,
      [sub(2, 'javascript', 'js'), sub(1, 'python', 'latest py')],
      'latest py',
    ],
    ['the template', null, [sub(1, 'javascript', 'js')], 'py-template'],
  ])('starts the code from %s', (_, draft, submissions, expected) => {
    it(`shows "${expected}"`, () => {
      writeLanguage(SLOT, 'python');
      if (draft) writeDraft(SLOT, 'python', draft);

      const { result } = mount(submissions);

      expect(result.current.code).toBe(expected);
      expect(result.current.startCode).toBe(expected);
    });
  });

  it('saves every edit as the draft of the current language', () => {
    const { result } = mount();

    act(() => result.current.setCode('edited'));

    expect(result.current.code).toBe('edited');
    expect(readDraft(SLOT, 'python')).toBe('edited');
    expect(readDraft(SLOT, 'javascript')).toBeNull();
  });

  it('keeps each language its own code and remembers the switch', () => {
    const { result } = mount();
    act(() => result.current.setCode('my py'));

    act(() => result.current.setLanguage('javascript'));
    expect(result.current.code).toBe('js-template');
    expect(readLanguage(SLOT)).toBe('javascript');

    act(() => result.current.setLanguage('python'));
    expect(result.current.code).toBe('my py');
  });

  it('reset puts the template back and saves it as the draft', () => {
    writeDraft(SLOT, 'python', 'old');
    const { result } = mount([sub(1, 'python', 'submitted')]);

    act(() => result.current.reset());

    expect(result.current.code).toBe('py-template');
    expect(readDraft(SLOT, 'python')).toBe('py-template');
  });

  it('loads a submission into its own language and keeps the start code', () => {
    const { result } = mount();

    act(() =>
      result.current.loadSubmission(sub(1, 'javascript', 'accepted js'))
    );

    expect(result.current.language).toBe('javascript');
    expect(result.current.code).toBe('accepted js');
    expect(result.current.startCode).toBe('js-template');
    expect(readDraft(SLOT, 'javascript')).toBe('accepted js');
    expect(readLanguage(SLOT)).toBe('javascript');
  });

  it('ignores a submission in a language no longer offered', () => {
    const { result } = mount();

    act(() => result.current.loadSubmission(sub(1, 'cobol', 'old')));

    expect(result.current.language).toBe('python');
    expect(result.current.code).toBe('py-template');
  });

  it('does not overwrite the code when the submissions list reloads', () => {
    const { result, rerender } = mount();
    act(() => result.current.setCode('typing'));

    rerender({ subs: [sub(1, 'python', 'just judged')] });

    expect(result.current.code).toBe('typing');
  });
});
