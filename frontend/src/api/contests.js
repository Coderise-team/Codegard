import client from './client';

// GET contests/?status=... -> paginated list; returns the results array.
export async function getContests(params = {}) {
  const { data } = await client.get('contests/', { params });
  return data.results;
}

// GET contests/?status=...&page=... -> the full paginated payload
// { results, count, next } (for the hub's infinite scroll).
export async function getContestsPage(params = {}) {
  const { data } = await client.get('contests/', { params });
  return data;
}

// GET contests/{id}/ -> contest detail incl. its problems.
export async function getContest(id) {
  const { data } = await client.get(`contests/${id}/`);
  return data;
}

// GET contests/{id}/my-standing/ -> { rank, score, solved, problems:[{id,status}] }
export async function getMyStanding(id) {
  const { data } = await client.get(`contests/${id}/my-standing/`);
  return data;
}

// GET contests/{id}/registrants/?page=... -> the full paginated payload
// { results, count, next }; rows { username, elo_rating }, rating desc.
export async function getRegistrants(id, params = {}) {
  const { data } = await client.get(`contests/${id}/registrants/`, { params });
  return data;
}

// GET contests/{id}/leaderboard/?page=... -> the full paginated payload
// { results, count, next }; rows { rank, username, score, penalty,
// solved_count, last_ac_at, rating_delta } (delta is null until the ELO run).
export async function getLeaderboard(id, params = {}) {
  const { data } = await client.get(`contests/${id}/leaderboard/`, { params });
  return data;
}

// POST contests/{id}/join/ — register the current user for a contest.
export async function joinContest(id) {
  await client.post(`contests/${id}/join/`);
}

// POST contests/{id}/leave/ — unregister the current user from a contest.
export async function leaveContest(id) {
  await client.post(`contests/${id}/leave/`);
}
