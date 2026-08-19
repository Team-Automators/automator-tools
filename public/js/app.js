// Token refresh: warn before expiry
(function () {
  const expiresAt = window.__tokenExpiresAt;
  if (!expiresAt) return;

  const msUntilExpiry = expiresAt - Date.now();
  const WARN_BEFORE = 5 * 60 * 1000; // 5 min

  if (msUntilExpiry < WARN_BEFORE) {
    refreshToken();
  } else {
    setTimeout(refreshToken, msUntilExpiry - WARN_BEFORE);
  }

  async function refreshToken() {
    try {
      const res = await fetch('/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        console.warn('Token refresh failed — session may expire soon.');
      }
    } catch (e) {
      console.warn('Token refresh error:', e);
    }
  }
})();
