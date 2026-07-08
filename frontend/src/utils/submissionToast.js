// Toast content for a judged submission: metrics for normal verdicts, the
// first stderr line for RE/CE (that's what the user needs to see first).
export function toastFor(s) {
  let detail = '';
  if (s.verdict === 'RE' || s.verdict === 'CE') {
    const text = s.stderr || s.error_message || '';
    detail = text.split('\n').find((line) => line.trim()) ?? '';
    if (detail.length > 140) detail = `${detail.slice(0, 140)}…`;
  } else if (s.execution_time_ms != null) {
    detail =
      `${s.execution_time_ms} ms` +
      (s.memory_used_mb != null ? ` · ${s.memory_used_mb} MB` : '');
  }
  return { verdict: s.verdict, label: s.verdict_display, detail };
}
