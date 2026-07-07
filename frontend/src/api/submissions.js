import client from './client';

// GET submissions/ -> paginated list of the authenticated user's submissions,
// newest first. Returns the results array.
export async function getSubmissions() {
  const { data } = await client.get('submissions/');
  return data.results;
}

// GET languages/ -> supported judge languages with editor starter templates
// ([{ id, name, template }]). Public config, not user-specific.
export async function getLanguages() {
  const { data } = await client.get('languages/');
  return data;
}
