(function () {
  'use strict';
  document.title = 'Job Queue Dashboard';
  window.DASHBOARD_INDEX = undefined;
  window.DASHBOARD_RECORDS = Object.create(null);
  var script = document.createElement('script');
  script.src = './dashboard-data/index.js';
  function failed() {
    document.getElementById('list').textContent =
      'The local application index could not be loaded. First run node scripts/init.mjs, or follow the manual setup in README.md. If already initialized, check dashboard-data/index.js and reload.';
  }
  script.onload = function () {
    var index = window.DASHBOARD_INDEX;
    if (!index || !Array.isArray(index.queue) || !Array.isArray(index.applications)) {
      failed(); return;
    }
    window.startJobDashboard();
  };
  script.onerror = failed;
  document.body.appendChild(script);
}());
