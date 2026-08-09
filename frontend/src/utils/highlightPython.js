// Lightweight Python syntax highlighter (regex based).
// Emits .tk-* spans; colours live in the page CSS.
export default function highlightPython(code) {
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const KEYWORDS =
    /\b(def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|pass|break|continue|lambda|yield|None|True|False|self)\b/g;
  const BUILTINS =
    /\b(print|len|range|int|str|list|dict|set|tuple|map|filter|enumerate|zip|sorted|reversed|sum|min|max|abs|round|type|isinstance|input|open)\b/g;
  let result = '';
  for (const line of code.split('\n')) {
    let l = esc(line);
    l = l.replace(/(#.*)$/, '<span class="tk-comment">$1</span>');
    if (!l.includes('tk-comment')) {
      l = l.replace(
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/g,
        '<span class="tk-string">$1</span>'
      );
      l = l.replace(/\b(\d+\.?\d*)\b/g, '<span class="tk-number">$1</span>');
      l = l.replace(KEYWORDS, '<span class="tk-keyword">$1</span>');
      l = l.replace(BUILTINS, '<span class="tk-builtin">$1</span>');
      l = l.replace(
        /\bdef\s+(<span[^>]*>def<\/span>\s+)?(\w+)/g,
        (m, kw, fn) => (kw || 'def ') + `<span class="tk-func">${fn}</span>`
      );
    }
    result += l + '\n';
  }
  return result;
}
