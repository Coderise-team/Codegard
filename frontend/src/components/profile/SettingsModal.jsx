import { useState } from 'react';
import Modal from '../Modal';
import ProfileForm from './ProfileForm';
import PasswordForm from './PasswordForm';
import './SettingsModal.css';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'password', label: 'Password' },
];

/**
 * SettingsModal — the owner's account settings, opened from the profile header.
 *
 * A dialog rather than a page: there are only a handful of fields, and the
 * profile stays visible underneath. The forms themselves live in their own
 * components, so moving all of this onto a /settings route later would mean
 * replacing this shell and nothing else.
 *
 * Mounted only while it is open, so every visit starts on the first tab with
 * empty forms and no state left over from the last one.
 *
 * Props:
 *   onClose — called on Escape, backdrop click or the close button
 *   onSaved — the profile changed, so the page behind should reload it
 */
export default function SettingsModal({ onClose, onSaved }) {
  const [tab, setTab] = useState(TABS[0].key);

  return (
    <Modal title="Settings" onClose={onClose}>
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
        className="modal-body scroll"
        role="tabpanel"
        id={`sm-panel-${tab}`}
        aria-labelledby={`sm-tab-${tab}`}
      >
        {tab === 'profile' ? (
          <ProfileForm onSaved={onSaved} onClose={onClose} />
        ) : (
          <PasswordForm onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}
