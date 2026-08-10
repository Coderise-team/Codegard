import tokenizePython from '../../utils/pythonTokens';

/**
 * Coloured Python source for the landing's editor mock and its how-it-works
 * pane. Renders the tokens as elements rather than injecting markup, so the
 * page never hands raw HTML to the DOM.
 *
 * Props:
 *   code — the source to show; may be a partial line while it is being typed
 */
export default function PythonCode({ code }) {
  return tokenizePython(code).map((token, i) =>
    token.cls ? (
      <span key={i} className={token.cls}>
        {token.text}
      </span>
    ) : (
      token.text
    )
  );
}
