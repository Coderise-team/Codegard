import { useContest } from './useContest';
import { letterToIndex } from '../utils/contestLetters';
import { isNotFound } from '../utils/errors';

/**
 * Resolves /contests/:id/problems/:letter into what the contest workspace
 * needs: the round itself plus the full statement of the addressed problem.
 *
 * The letter is a position in the contest's problem list, and the entry there
 * carries the whole statement: a contest problem is normally hidden, and the
 * catalogue serves no hidden problem to anyone.
 *
 * `notFound` folds together every "this URL addresses nothing" case: unknown
 * contest, a :letter that is not a letter, and a letter past the end of the
 * round. A contest that has not started yet lands here too, because the
 * backend hides its problems until the start.
 */
export function useContestProblem(contestId, letter) {
  const { contest, loading, error } = useContest(contestId);

  const index = letterToIndex(letter);
  const entry = index < 0 ? undefined : contest?.problems?.[index];

  const notFound =
    isNotFound(error) || (contest != null && entry === undefined);

  return { contest, problem: entry ?? null, loading, error, notFound };
}
