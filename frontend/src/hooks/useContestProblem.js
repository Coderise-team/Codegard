import { useContest } from './useContest';
import { useProblem } from './useProblem';
import { letterToIndex } from '../utils/contestLetters';
import { isNotFound } from '../utils/errors';

/**
 * Resolves /contests/:id/problems/:letter into what the contest workspace
 * needs: the round itself plus the full statement of the addressed problem.
 *
 * The letter is a position in the contest's problem list, and that entry
 * carries the catalogue id. The statement is then loaded from the catalogue on
 * purpose: the contest payload ships a trimmed problem (no tags, no acceptance,
 * no input/output format, no examples), which is not enough to render the
 * statement pane.
 *
 * `notFound` folds together every "this URL addresses nothing" case: unknown
 * contest, a :letter that is not a letter, and a letter past the end of the
 * round. A contest that has not started yet also lands here, because the
 * backend hides its problems until the start.
 */
export function useContestProblem(contestId, letter) {
  const {
    contest,
    loading: contestLoading,
    error: contestError,
  } = useContest(contestId);

  const index = letterToIndex(letter);
  const entry = index < 0 ? undefined : contest?.problems?.[index];
  const problemId = entry?.id ?? null;

  const {
    data: problem,
    loading: problemLoading,
    error: problemError,
  } = useProblem(problemId);

  // Without an addressed problem there is nothing to wait for — useProblem sits
  // at loading:true on a null id, and that must not leak out as "still loading".
  const loading = contestLoading || (problemId != null && problemLoading);
  const error = contestError ?? problemError;
  const notFound =
    isNotFound(contestError) ||
    isNotFound(problemError) ||
    (contest != null && entry === undefined);

  return { contest, problem, loading, error, notFound };
}
