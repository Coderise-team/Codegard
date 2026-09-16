import client from './client';

// GET problems/ -> one paginated page of the catalog
// ({ count, next, previous, results }). `params` carries the filters/sort/page;
// array params (tag) repeat as tag=A&tag=B (indexes:null), which the backend
// reads with getlist("tag").
export async function getProblems(params) {
  const { data } = await client.get('problems/', {
    params,
    paramsSerializer: { indexes: null },
  });
  return data;
}

// GET problems/{id}/ -> full problem for the workspace: statement texts
// (description, input_format, output_format, constraints), difficulty,
// time_limit (ms), memory_limit (MB), tags, acceptance, status and the
// visible test_cases ([{ id, input, expected_output, note }]).
export async function getProblem(id) {
  const { data } = await client.get(`problems/${id}/`);
  return data;
}

// GET problems/tags/ -> all catalog tags with their problem counts
// ([{ name, count }]), for the filter dropdown.
export async function getTags() {
  const { data } = await client.get('problems/tags/');
  return data;
}

// GET problems/recommended/ -> up to 6 unsolved problems for the current user
// ([{ id, title, difficulty, tags, acceptance }]), ordered easy -> hard.
export async function getRecommended() {
  const { data } = await client.get('problems/recommended/');
  return data;
}

// GET problems/daily/ -> today's shared daily challenge, or null when none is
// assigned yet ({ id, title, difficulty, tags, acceptance, solved_today }).
export async function getDaily() {
  const { data } = await client.get('problems/daily/');
  return data;
}

// GET report-reasons/ -> the reasons a problem can be reported for
// ([{ id, name }]), so the form offers exactly what the backend accepts.
export async function getReportReasons() {
  const { data } = await client.get('report-reasons/');
  return data;
}

// POST problems/{id}/report/ -> file a complaint about a problem
// ({ reason, message }) and get back a { detail } confirmation. The backend
// answers 400 with a { detail } of its own while the user already has five
// unresolved reports on that problem, and 429 past ten attempts an hour
// (refused ones count too).
export async function reportProblem(id, body) {
  const { data } = await client.post(`problems/${id}/report/`, body);
  return data;
}
