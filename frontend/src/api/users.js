import client from './client';

// GET users/{username}/stats/ -> { solved, contests, acceptance }
export async function getUserStats(username) {
  const { data } = await client.get(`users/${username}/stats/`);
  return data;
}

// GET users/{username}/activity/ -> sparse { "YYYY-MM-DD": submissions } map
// (only days with at least one submission are present).
export async function getUserActivity(username) {
  const { data } = await client.get(`users/${username}/activity/`);
  return data;
}

// GET users/{username}/ ->
// { username, elo_rating, rank, avatar, bio, maxRating, globalRank, nextTier }
// nextTier: { name, floor, ceil } or null at the top tier.
export async function getUser(username) {
  const { data } = await client.get(`users/${username}/`);
  return data;
}

// GET users/{username}/elo-history/ -> [{ rating, created_at }] oldest-first
export async function getEloHistory(username) {
  const { data } = await client.get(`users/${username}/elo-history/`);
  return data;
}

// GET users/{username}/streak/ -> { current_streak, longest_streak, history }
// history: [{ date, status }] (status: solved | missed | today) oldest-first.
export async function getStreak(username) {
  const { data } = await client.get(`users/${username}/streak/`);
  return data;
}

// GET users/{username}/contest-history/ -> finished contests, newest first.
// Paginated {count, next, previous, results}; the dashboard block wants 5.
// [{ id, title, subtitle, end_time, rank, solved, rating_delta, rating_after }]
export async function getContestHistory(username) {
  const { data } = await client.get(`users/${username}/contest-history/`, {
    params: { page_size: 5 },
  });
  return data.results;
}

// GET users/{username}/difficulty/ -> solved/total per difficulty
// { easy: { solved, total }, medium: { solved, total }, hard: { solved, total } }
export async function getDifficultyBreakdown(username) {
  const { data } = await client.get(`users/${username}/difficulty/`);
  return data;
}

// GET users/{username}/submissions/ -> latest submissions (no source code),
// newest first. Paginated {count, next, previous, results}; the dashboard block
// wants 6. [{ id, problem, problem_title, verdict, verdict_display,
// language_display, execution_time_ms, created_at }]
export async function getUserSubmissions(username, pageSize) {
  const { data } = await client.get(`users/${username}/submissions/`, {
    params: pageSize ? { page_size: pageSize } : {},
  });
  return data.results;
}
