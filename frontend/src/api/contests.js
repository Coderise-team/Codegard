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

// POST contests/{id}/join/ — register the current user for a contest.
export async function joinContest(id) {
  await client.post(`contests/${id}/join/`);
}

// POST contests/{id}/leave/ — unregister the current user from a contest.
export async function leaveContest(id) {
  await client.post(`contests/${id}/leave/`);
}
