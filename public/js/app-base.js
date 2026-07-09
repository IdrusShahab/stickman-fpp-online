(function () {
  'use strict';

  const PREFIX = '/fppstickman';
  const path = window.location.pathname;
  window.APP_BASE = path === PREFIX || path.startsWith(PREFIX + '/') ? PREFIX : '';
})();