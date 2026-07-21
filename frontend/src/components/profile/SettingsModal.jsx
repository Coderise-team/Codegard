import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icons from '../Icons';
import ProfileForm from './ProfileForm';
import './SettingsModal.css';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'password', label: 'Password' },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * SettingsModal — the owner's account settings, opened from the profile header.
 *
 * A dialog rather than a page: there are only a handful of fields, and the
 * profile stays visible underneath. The forms themselves live in their own
 * components, so moving all of this onto a /settings route later would mean
 * replacing this shell and nothing else.
 *
 * Props:
 *   open    — whether the dialog is shown
 *   onClose — called on Escape, backdrop click or the close button
 *   onSaved — the profile changed, so the page behind should reload it
 */
export default function SettingsModal({ open, onClose, onSaved }) {
  const [tab, setTab] = useState(TABS[0].key);
  const panelRef = useRef(null);

  // Kept in a ref so the effect below depends on `open` alone: a parent that
  // passes an inline onClose would otherwise re-run it on every render,
  // stealing focus back from whatever field is being typed into.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    // Always open on the first tab, and hand focus to the dialog so the
    // keyboard doesn't stay behind on the page underneath.
    setTab(TABS[0].key);
    const opener = document.activeElement;
    panelRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep Tab inside the dialog: without this it walks into the page behind,
      // where the user can't see what is focused.
      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="sm-scrim"
      // mousedown, not click: releasing the button outside after selecting text
      // inside the dialog would otherwise be read as a backdrop click.
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="sm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sm-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="sm-head">
          <h2 id="sm-title">Settings</h2>
          <button
            type="button"
            className="sm-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <Icons.x size={17} />
          </button>
        </header>

        <div className="sm-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`sm-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`sm-panel-${t.key}`}
              className={`sm-tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="sm-body"
          role="tabpanel"
          id={`sm-panel-${tab}`}
          aria-labelledby={`sm-tab-${tab}`}
        >
          {tab === 'profile' && (
            <ProfileForm onSaved={onSaved} onClose={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
