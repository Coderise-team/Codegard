import client from './client';

// GET submissions/ -> paginated list of the authenticated user's submissions,
// newest first. Returns the results array. Optional `params` narrow the list
// (e.g. { problem: id }).
export async function getSubmissions(params) {
  const { data } = await client.get('submissions/', { params });
  return data.results;
}

// GET languages/ -> supported judge languages with editor starter templates
// ([{ id, name, template }]). Public config, not user-specific.
export async function getLanguages() {
  const { data } = await client.get('languages/');
  return data;
}
