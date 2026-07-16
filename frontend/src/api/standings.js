import client from './client';

// GET users/standings/ -> one page of the global ELO leaderboard:
// { count, total, next, previous, you, results }.
// count  — rows matching the current filter; total — all ranked coders.
// you    — the signed-in user's row, always present regardless of the filter
//          or which page is loaded.
// A row is { username, avatar, elo_rating, maxRating, globalRank, delta };
// globalRank is a dense rank over the field being sorted by, delta may be null.
// `params` carries ordering (elo_rating | max_rating, '-' = descending),
// tier (rank name) and page.
export async function getStandings(params) {
  const { data } = await client.get('users/standings/', { params });
  return data;
}
