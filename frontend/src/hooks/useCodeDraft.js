import { useState } from 'react';

import {
  readDraft,
  writeDraft,
  readLanguage,
  writeLanguage,
} from '../utils/codeDrafts';

/**
 * Editor code and language for one problem, kept as a draft per language.
 *
 * Where the code starts, per language: the saved draft, else the code of the
 * latest submission in that language, else the language template. The
 * language starts as the remembered one, else the latest submission's, else
 * the first offered. A submission in a language no longer offered is skipped.
 *
 * Everything is read once, when the hook mounts: the workspace is remounted
 * for every problem, and a later reload of `submissions` (after a verdict)
 * must not overwrite what is being typed.
 *
 * @param slot        storage prefix from draftSlot()
 * @param languages   [{ id, name, template }] from GET languages/
 * @param submissions the user's submissions here, newest first
 * @returns language, code, startCode (what the current language started with
 *          on mount), setLanguage, setCode, reset, loadSubmission
 */
export function useCodeDraft(slot, languages, submissions) {
  const offered = (id) => languages.some((l) => l.id === id);

  const [startCodes] = useState(() =>
    Object.fromEntries(
      languages.map((l) => [
        l.id,
        readDraft(slot, l.id) ??
          submissions.find((s) => s.language === l.id)?.code ??
          l.template,
      ])
    )
  );
  const [codes, setCodes] = useState(startCodes);

  const [language, setLanguageState] = useState(() => {
    const remembered = readLanguage(slot);
    if (offered(remembered)) return remembered;
    const latest = submissions[0]?.language;
    if (offered(latest)) return latest;
    return languages[0].id;
  });

  const put = (lang, code) => setCodes((prev) => ({ ...prev, [lang]: code }));

  const setLanguage = (lang) => {
    setLanguageState(lang);
    writeLanguage(slot, lang);
  };

  const setCode = (code) => {
    put(language, code);
    writeDraft(slot, language, code);
  };

  // The template is saved as the draft, not the draft dropped: otherwise a
  // reload would bring back the latest submission instead of the reset code.
  const reset = () =>
    setCode(languages.find((l) => l.id === language).template);

  // Puts a past submission's code into the editor, in its own language.
  const loadSubmission = (submission) => {
    if (!offered(submission.language)) return;
    setLanguage(submission.language);
    put(submission.language, submission.code);
    writeDraft(slot, submission.language, submission.code);
  };

  return {
    language,
    code: codes[language],
    startCode: startCodes[language],
    setLanguage,
    setCode,
    reset,
    loadSubmission,
  };
}
