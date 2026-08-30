// Minimal Python tokenizer for the code samples on the landing page. The
// editor there is a mock, so it only needs enough structure to colour the
// sample — Monaco is far too heavy to load on a marketing page.
//
// Returns a flat list of { cls, text } covering the whole input in order;
// `cls` is null for anything that keeps the default colour. The classes are
// styled by the .tk-* rules in LandingPage.css.

const words = (list) => new Set(list.split(' '));

const KEYWORDS = words(
  'def class return if elif else for while in not and or import from as with' +
    ' try except finally raise pass break continue lambda yield None True' +
    ' False self'
);

const BUILTINS = words(
  'print len range int str list dict set tuple map filter enumerate zip' +
    ' sorted reversed sum min max abs round type isinstance input open'
);

// Sticky patterns, tried in this order at every position. A comment or a
// string swallows its whole span, so nothing inside one is coloured again.
const COMMENT = /#[^\n]*/y;
const STRING =
  /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y;
const NUMBER = /\d+\.?\d*/y;
const NAME = /[A-Za-z_]\w*/y;

function matchAt(pattern, code, index) {
  pattern.lastIndex = index;
  return pattern.exec(code);
}

export default function tokenizePython(code) {
  const tokens = [];
  let plain = '';
  // `def` colours the name that follows it as a function.
  let namesFunction = false;

  const flush = () => {
    if (!plain) return;
    tokens.push({ cls: null, text: plain });
    plain = '';
  };

  const push = (cls, text) => {
    flush();
    tokens.push({ cls, text });
  };

  let i = 0;
  while (i < code.length) {
    const comment = matchAt(COMMENT, code, i);
    if (comment) {
      push('tk-comment', comment[0]);
      i += comment[0].length;
      continue;
    }

    const string = matchAt(STRING, code, i);
    if (string) {
      push('tk-string', string[0]);
      i += string[0].length;
      continue;
    }

    const number = matchAt(NUMBER, code, i);
    if (number) {
      push('tk-number', number[0]);
      i += number[0].length;
      continue;
    }

    // Names are consumed whole, so a keyword is never matched inside a longer
    // identifier ("definition" does not start with the keyword "def").
    const name = matchAt(NAME, code, i);
    if (name) {
      const word = name[0];
      let cls = null;
      if (KEYWORDS.has(word)) cls = 'tk-keyword';
      else if (BUILTINS.has(word)) cls = 'tk-builtin';
      else if (namesFunction) cls = 'tk-func';

      namesFunction = word === 'def';
      if (cls) push(cls, word);
      else plain += word;
      i += word.length;
      continue;
    }

    plain += code[i];
    i += 1;
  }

  flush();
  return tokens;
}
