import Icons from '../Icons';

/**
 * ActionBar — editor footer: status line + Reset / Submit actions.
 *
 * Props:
 *   busy       — falsy | 'submit' (disables actions, spins the button)
 *   statusText — short status line ("Python 3 · ready", "Judging…")
 *   onSubmit, onReset
 */
export default function ActionBar({ busy, statusText, onSubmit, onReset }) {
  return (
    <div className="pp-actionbar">
      <div className="pp-ab-status">
        <Icons.terminal size={14} /> {statusText}
      </div>
      <div className="pp-ab-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={onReset}
          disabled={!!busy}
        >
          <Icons.reset size={15} /> Reset
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onSubmit}
          disabled={!!busy}
        >
          {busy === 'submit' ? (
            <span className="spin" />
          ) : (
            <Icons.send size={15} />
          )}{' '}
          Submit
        </button>
      </div>
    </div>
  );
}
