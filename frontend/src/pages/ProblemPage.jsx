import SoloTopbar from '../components/problem/SoloTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';

// STUB: inline mock data (the mock has no data file for this page);
// replaced with real API data in plan steps 5-8.
const STUB_PROBLEM = {
  id: 1,
  title: 'Two Sum',
  difficulty: 'Easy',
  acceptance: 47.3,
  timeLimit: '1000 ms',
  memoryLimit: '256 MB',
  tags: ['arrays', 'hash-map'],
  statement: [
    'You are given an array of integers nums and an integer target. Return ' +
      'the indices of the two numbers that add up to target.',
    'Each input has exactly one solution, and you may not use the same ' +
      'element twice. The answer can be returned in any order.',
  ],
  inputFormat: [
    'The first line contains two integers n and target. The second line ' +
      'contains n space-separated integers — the array nums.',
  ],
  outputFormat: ['Two space-separated indices i and j (i < j).'],
  constraints: [
    '2 ≤ n ≤ 10^5',
    '-10^9 ≤ nums[i] ≤ 10^9',
    'Exactly one valid answer exists.',
  ],
  examples: [
    {
      input: '4 9\n2 7 11 15',
      output: '0 1',
      note: 'nums[0] + nums[1] = 2 + 7 = 9.',
    },
    { input: '3 6\n3 2 4', output: '1 2', note: '' },
  ],
};

// STUB: replaced by GET submissions/?problem=id in plan step 7.
const STUB_SUBMISSIONS = [
  {
    id: 412,
    verdict: 'AC',
    lang: 'Python 3',
    runtime: '88 ms',
    memory: '18 MB',
    when: '2h ago',
  },
  {
    id: 398,
    verdict: 'WA',
    lang: 'Python 3',
    runtime: '61 ms',
    memory: '18 MB',
    when: '3h ago',
  },
  {
    id: 371,
    verdict: 'TLE',
    lang: 'Python 3',
    runtime: '—',
    memory: '—',
    when: '5h ago',
  },
];

// STUB: starter template comes from GET languages/ in plan step 6.
const STUB_STARTER =
  'import sys\n\ndata = sys.stdin.read().split()\n# your code here\n';

// STUB: real viewer comes from useCurrentUser in plan step 4.
const STUB_USER = {
  handle: 'test',
  rating: 1850,
  rank: 'Master',
  initials: 'TE',
};

/**
 * ProblemPage — solo problem solving at /problems/:id.
 * Composes the mode-agnostic ProblemWorkspace with the solo topbar.
 */
export default function ProblemPage() {
  return (
    <div className="pp-app" data-density="compact">
      <SoloTopbar title={STUB_PROBLEM.title} user={STUB_USER} />
      <ProblemWorkspace
        problem={STUB_PROBLEM}
        submissions={STUB_SUBMISSIONS}
        starterCode={STUB_STARTER}
        busy={null}
        statusText="Python 3 · ready"
        onSubmit={() => {}} // STUB: wired to POST submissions/ in plan step 8
      />
    </div>
  );
}
