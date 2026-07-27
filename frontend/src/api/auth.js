import client from './client';

// POST users/register/ -> { access, refresh }
export async function register({ username, email, password }) {
  const { data } = await client.post('users/register/', {
    username,
    email,
    password,
  });
  return data;
}

// GET users/me/ -> { username, avatar }
export async function me() {
  const { data } = await client.get('users/me/');
  return data;
}

// POST users/login/ -> { access, refresh }. `username` accepts a username or an email.
export async function login({ username, password }) {
  const { data } = await client.post('users/login/', { username, password });
  return data;
}

// POST users/logout/ (Bearer + refresh) -> 205, blacklists the refresh token.
export async function logout(refreshToken) {
  await client.post('users/logout/', { refresh: refreshToken });
}

// GET users/oauth/<provider>/start/ -> { authorize_url } to send the browser to.
export async function oauthStart(provider) {
  const { data } = await client.get(`users/oauth/${provider}/start/`);
  return data;
}

// POST users/oauth/redeem/ -> { access, refresh }. The one-time ticket comes
// from the provider round-trip (backend redirects to /oauth/callback?ticket=).
export async function oauthRedeem(ticket) {
  const { data } = await client.post('users/oauth/redeem/', { ticket });
  return data;
}

// PATCH users/me/ -> the updated profile. Takes a partial payload: only the keys
// present are changed, and only bio / first_name / last_name are editable at all.
export async function updateProfile(payload) {
  const { data } = await client.patch('users/me/', payload);
  return data;
}

// POST users/me/password/ -> { access, refresh }. The change revokes every
// outstanding refresh token, so the caller must store the returned pair right
// away or the next 401 will log the user out.
export async function changePassword({ old_password, new_password }) {
  const { data } = await client.post('users/me/password/', {
    old_password,
    new_password,
  });
  return data;
}

// POST users/avatar/ (multipart) -> { avatar, thumbnails: { 128, 256 } }
export async function uploadAvatar(file) {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await client.post('users/avatar/', form);
  return data;
}
