// Editor drafts kept in localStorage, so the code survives a reload. A draft
// belongs to one user, one problem and one place it is solved in: a round
// keeps its own drafts, apart from the catalogue and from other rounds. Each
// language has its own draft, and the slot also remembers the last language.
//
// Storage can be unavailable (private mode, blocked site data, full quota):
// then reads come back empty and writes are dropped, and the editor simply
// starts from the fallback code.

/**
 * The storage prefix for one user's work on one problem in one place:
 * `draft:<username>:<contest id | solo>:<problem id>`.
 */
export function draftSlot(username, problemId, contestId) {
  const place = contestId != null ? `c${contestId}` : 'solo';
  return `draft:${username}:${place}:${problemId}`;
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or full: the draft just isn't kept.
  }
}

export const readDraft = (slot, language) => read(`${slot}:code:${language}`);

export const writeDraft = (slot, language, code) =>
  write(`${slot}:code:${language}`, code);

export const readLanguage = (slot) => read(`${slot}:lang`);

export const writeLanguage = (slot, language) =>
  write(`${slot}:lang`, language);
