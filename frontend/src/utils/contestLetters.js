// Contest problems are addressed by position, not by catalogue id: A, B, … Z,
// AA, AB, … The same labels are both what the round shows on screen and the
// :letter segment of /contests/:id/problems/:letter, so both directions of the
// mapping live here rather than being re-derived per page.

// 0 -> "A", 25 -> "Z", 26 -> "AA"
export function indexToLetter(index) {
  let label = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    label = String.fromCharCode(65 + (n % 26)) + label;
  }
  return label;
}

// Inverse of indexToLetter, so a hand-typed lowercase URL still resolves.
// Anything that is not a run of letters yields -1 — the caller treats that the
// same as a letter past the end of the round.
export function letterToIndex(letter) {
  if (typeof letter !== 'string' || !/^[a-z]+$/i.test(letter)) return -1;
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}
