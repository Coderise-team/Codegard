import tokenizePython from '../../utils/pythonTokens';

/**
 * Coloured Python source for the landing's editor mock and its how-it-works
 * pane. Renders the tokens as elements rather than injecting markup, so the
 * page never hands raw HTML to the DOM.
 *
 * Every token gets an element of its own, uncoloured ones included. A bare
 * string would become a text node with nothing around it, and a page
 * translator swaps such nodes out from under React — which then fails to find
 * them the next time the code is retyped and brings the page down.
 *
 * Props:
 *   code — the source to show; may be a partial line while it is being typed
 */
export default function PythonCode({ code }) {
  return tokenizePython(code).map((token, i) => (
    <span key={i} className={token.cls || undefined}>
      {token.text}
    </span>
  ));
}
