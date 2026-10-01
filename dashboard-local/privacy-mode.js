(function () {
  'use strict';
  var storageKey = 'job-dashboard:privacy-mode';
  var url = new URL(window.location.href);
  var explicit = url.searchParams.get('privacy');
  var saved = false;
  try { saved = window.localStorage.getItem(storageKey) === '1'; } catch (_) { /* Storage may be unavailable for local files. */ }
  var enabled = explicit === '1' ? true : explicit === '0' ? false
    : saved;

  function setEnabled(value) {
    window.JobDashboardPrivacy.enabled = value === true;
    document.documentElement.dataset.privacyMode = value ? 'on' : 'off';
    try { window.localStorage.setItem(storageKey, value ? '1' : '0'); } catch (_) { /* The URL still carries the preference. */ }
    var next = new URL(window.location.href);
    if (value) next.searchParams.set('privacy', '1');
    else next.searchParams.delete('privacy');
    if (next.href !== window.location.href) {
      try { window.history.replaceState(null, '', next.href); } catch (_) { /* Some file viewers restrict history changes. */ }
    }
  }

  window.JobDashboardPrivacy = { enabled: enabled, setEnabled: setEnabled };
  setEnabled(enabled);
}());
