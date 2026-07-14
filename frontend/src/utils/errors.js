// True when the backend answered "this resource does not exist".
// A dropped connection leaves an axios error with no `response` at all, so the
// status has to be read defensively — that case is a failure, not a 404.
export function isNotFound(error) {
  return error?.response?.status === 404;
}
