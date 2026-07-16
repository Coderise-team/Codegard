// Where to send the user after the OAuth round-trip. location.state does not
// survive the full-page redirect through the provider, so the origin page is
// stashed in sessionStorage before leaving and popped on /oauth/callback.
const KEY = 'oauth_from';

export function stashOAuthFrom(path) {
  sessionStorage.setItem(KEY, path);
}

// Single-use: read and clear, falling back to home.
export function popOAuthFrom() {
  const path = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return path || '/';
}

// Thin wrapper so tests can mock the full-page provider redirect: jsdom's
// window.location is unforgeable and cannot be stubbed directly.
export function redirectToProvider(url) {
  window.location.assign(url);
}
