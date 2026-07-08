import client from './client';

// GET submissions/ -> paginated list of the authenticated user's submissions,
// newest first. Returns the results array. Optional `params` narrow the list
// (e.g. { problem: id }).
export async function getSubmissions(params) {
  const { data } = await client.get('submissions/', { params });
  return data.results;
}

// GET submissions/{id}/ -> one own submission: verdict, verdict_display,
// execution_time_ms, memory_used_mb, stderr, error_message, created_at.
export async function getSubmission(id) {
  const { data } = await client.get(`submissions/${id}/`);
  return data;
}

// POST submissions/ -> queues the solution for judging. Returns
// { id, status: 'queued' | 'queue_error', verdict: null, created_at }.
export async function createSubmission({ problem, code, language }) {
  const { data } = await client.post('submissions/', {
    problem,
    code,
    language,
  });
  return data;
}

// GET languages/ -> supported judge languages with editor starter templates
// ([{ id, name, template }]). Public config, not user-specific.
export async function getLanguages() {
  const { data } = await client.get('languages/');
  return data;
}
