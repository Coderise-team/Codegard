import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icons from './Icons';
import './Modal.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal — the dialog frame: backdrop, panel, title bar with a close button.
 *
 * Rendered in a portal on <body>, so no page container can clip it or stack
 * above it. While mounted it takes the keyboard: focus moves into the panel,
 * Tab cycles inside it, Escape closes, and focus returns to whatever opened
 * it. The page behind does not scroll.
 *
 * The content goes right under the title bar; a scrolling area is the
 * consumer's `modal-body`, so anything that must stay put (tabs) sits above it.
 *
 * Props:
 *   title    — heading text, also the dialog's accessible name
 *   onClose  — called on Escape, backdrop press or the close button
 *   children — dialog content
 */
export default function Modal({ title, onClose, children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  // Kept in a ref so the effect below runs once per mount: a parent that
  // passes an inline onClose would otherwise re-run it on every render,
  // stealing focus back from whatever field is being typed into.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
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
  }, []);

  return createPortal(
    <div
      className="modal-scrim"
      // mousedown, not click: releasing the button outside after selecting text
      // inside the dialog would otherwise be read as a backdrop click.
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icons.x size={17} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}
