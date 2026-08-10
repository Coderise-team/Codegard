// =============================================================
// Codegard — Landing page content + mock data.
// Marketing copy, the demo submission, the live-contest board and
// the global-rating sample rows all live here so the components
// stay presentational. Tier colors are SEMANTIC (the rank ladder),
// matching utils/ranks.js.
// =============================================================

export const DEMO_CODE = [
  'class Solution:',
  '    def twoSum(self, nums: List[int], target: int) -> List[int]:',
  '        seen = {}',
  '        for i, x in enumerate(nums):',
  '            need = target - x',
  '            if need in seen:',
  '                return [seen[need], i]',
  '            seen[x] = i',
  '        return []',
].join('\n');

const landingData = {
  hero: {
    eyebrow: 'Free · rated contests every week',
    lines: ['Write code.', 'Get judged.', 'Climb the rating.'],
    sub: 'Codegard runs the problems, the live contests and the Elo ladder that ranks everyone who solves them.',
    note: 'No card, no trial. Every problem and every contest is free.',
  },

  // live contest board (rows re-sort as points come in)
  contest: {
    name: 'Div. 2 · Round 418',
    secondsLeft: 1 * 3600 + 23 * 60 + 45,
    problems: [
      { id: 'A', state: 'solved' },
      { id: 'B', state: 'solved' },
      { id: 'C', state: 'cur' },
      { id: 'D', state: 'att' },
      { id: 'E', state: '' },
    ],
    board: [
      {
        handle: 'n3ptune',
        initials: 'NP',
        you: true,
        pts: 1840,
        solved: 4,
        pen: 2,
        last: '00:41',
      },
      {
        handle: 'hexraven',
        initials: 'HR',
        pts: 2020,
        solved: 5,
        pen: 1,
        last: '00:12',
      },
      {
        handle: 'voidwolf',
        initials: 'VW',
        pts: 1955,
        solved: 4,
        pen: 0,
        last: '00:29',
      },
      {
        handle: 'segfaultx',
        initials: 'SX',
        pts: 1780,
        solved: 4,
        pen: 3,
        last: '00:55',
      },
      {
        handle: 'lambdacore',
        initials: 'LC',
        pts: 1610,
        solved: 3,
        pen: 1,
        last: '01:04',
      },
      {
        handle: 'turingfox',
        initials: 'TF',
        pts: 1540,
        solved: 3,
        pen: 2,
        last: '01:18',
      },
    ],
  },

  steps: [
    {
      t: 'Pick a problem',
      d: 'Statement, limits, samples and tags on one screen. Filter by topic or by rating.',
    },
    {
      t: 'Write the solution',
      d: 'Editor with your language, sample input at hand, run before you commit.',
    },
    {
      t: 'Submit to the judge',
      d: 'One verdict comes back with runtime and memory. No guessing which test failed.',
    },
    {
      t: 'Move the rating',
      d: 'Every rated contest recomputes your Elo and your place in the global ladder.',
    },
  ],

  // global rating — order is 2nd / 1st / 3rd; CSS puts them on the podium
  podium: [
    {
      rank: 2,
      handle: 'quantumlynx',
      initials: 'QL',
      rating: 3187,
      tier: 'Kernel',
      color: '#F87171',
    },
    {
      rank: 1,
      handle: 'hexraven',
      initials: 'HR',
      rating: 3241,
      tier: 'Kernel',
      color: '#F87171',
    },
    {
      rank: 3,
      handle: 'eulergate',
      initials: 'EG',
      rating: 3126,
      tier: 'Kernel',
      color: '#F87171',
    },
  ],
  table: [
    {
      rank: 4,
      handle: 'dijkstraflux',
      initials: 'DF',
      rating: 3044,
      delta: 28,
      tier: 'Architect',
      color: '#FB923C',
    },
    {
      rank: 5,
      handle: 'voidwolf',
      initials: 'VW',
      rating: 2971,
      delta: -12,
      tier: 'Architect',
      color: '#FB923C',
    },
    {
      rank: 6,
      handle: 'cipherzero',
      initials: 'CZ',
      rating: 2884,
      delta: 44,
      tier: 'Architect',
      color: '#FB923C',
    },
    {
      rank: 7,
      handle: 'modulowave',
      initials: 'MW',
      rating: 2790,
      delta: 9,
      tier: 'Architect',
      color: '#FB923C',
    },
    {
      rank: 8,
      handle: 'gaussnode',
      initials: 'GN',
      rating: 2612,
      delta: -31,
      tier: 'Grandmaster',
      color: '#F472B6',
    },
    {
      rank: 9,
      handle: 'heapifyx',
      initials: 'HX',
      rating: 2455,
      delta: 17,
      tier: 'Grandmaster',
      color: '#F472B6',
    },
    {
      rank: 214,
      handle: 'n3ptune',
      initials: 'NP',
      rating: 2147,
      delta: 35,
      tier: 'Master',
      color: '#A78BFA',
      you: true,
    },
  ],
  ladder: [
    { name: 'Trainee', min: 0, color: '#7E8796' },
    { name: 'Junior', min: 1000, color: '#22C55E' },
    { name: 'Specialist', min: 1300, color: '#2DD4BF' },
    { name: 'Expert', min: 1600, color: '#38BDF8' },
    { name: 'Master', min: 1900, color: '#A78BFA' },
    { name: 'Grandmaster', min: 2300, color: '#F472B6' },
    { name: 'Architect', min: 2700, color: '#FB923C' },
    { name: 'Kernel', min: 3100, color: '#F87171' },
  ],

  judge: [
    { icon: 'cpu', t: 'Every run happens in an isolated sandbox.' },
    { icon: 'clock', t: 'Each problem carries its own time and memory limit.' },
    { icon: 'flag', t: 'Full verdict set: AC, WA, TLE, MLE, OLE, RE, CE.' },
    {
      icon: 'trophy',
      t: 'Contest standings update live; rating is recomputed when the round closes.',
    },
  ],

  faq: [
    {
      q: 'Does Codegard cost anything?',
      a: 'No. Every problem, every contest and the full rating system are open to all accounts.',
    },
    {
      q: 'Which languages can I submit?',
      a: 'Python, C++, Java, Go, Rust, C# and JavaScript. Each language gets its own time multiplier so the limits stay fair.',
    },
    {
      q: 'How is the rating calculated?',
      a: 'Elo over rated contests. Your result is compared to the expected result against everyone in the round, then your rating moves. Practice submissions never touch it.',
    },
    {
      q: 'What happens if I join a contest late?',
      a: 'You start with the time that is left. Points scale with the moment you solve, so a late start costs score but not participation.',
    },
    {
      q: 'Can I see other solutions after a contest?',
      a: 'Yes. Editorials and accepted submissions open when the round ends and the standings are frozen.',
    },
    {
      q: 'Do I need to install anything?',
      a: 'No. Everything runs in the browser, including the editor and the judge.',
    },
  ],
};

export default landingData;
