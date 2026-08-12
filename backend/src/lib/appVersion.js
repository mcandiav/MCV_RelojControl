'use strict';

const fs = require('fs');
const path = require('path');

function readVersionFile() {
  const candidates = [
    path.join(__dirname, '../../VERSION'),
    path.join(__dirname, '../../../VERSION'),
    path.join(process.cwd(), 'VERSION')
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const v = fs.readFileSync(file, 'utf8').trim();
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

/** Product version (not Git hash). Prefer env, then VERSION file, then fallback. */
const APP_RELEASE = String(
  process.env.APP_RELEASE || readVersionFile() || 'V6.0.1'
).trim();

const APP_GIT = String(
  process.env.APP_BUILD_VERSION || process.env.GIT_SHA || process.env.BUILD_VERSION || 'dev'
).trim();

module.exports = { APP_RELEASE, APP_GIT };
