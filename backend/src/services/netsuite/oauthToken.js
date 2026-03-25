const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getNetsuiteConfig } = require('./config');

let cache = {
  accessToken: null,
  expiresAtMs: 0
};

function signClientAssertion(cfg) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cfg.clientId,
    scope: cfg.scope,
    aud: cfg.tokenUrl,
    iat: now,
    exp: now + 3540,
    jti: crypto.randomBytes(16).toString('hex')
  };

  const signOptions = {
    algorithm: 'PS256',
    keyid: cfg.certificateId,
    header: { typ: 'JWT', kid: cfg.certificateId, alg: 'PS256' }
  };

  try {
    return jwt.sign(payload, cfg.privateKeyPem, signOptions);
  } catch (e) {
    return jwt.sign(payload, cfg.privateKeyPem, {
      algorithm: 'RS256',
      keyid: cfg.certificateId,
      header: { typ: 'JWT', kid: cfg.certificateId, alg: 'RS256' }
    });
  }
}

async function fetchNewAccessToken(cfg) {
  const clientAssertion = signClientAssertion(cfg);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion
  });

  const { data } = await axios.post(cfg.tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 60000
  });

  if (!data || !data.access_token) {
    throw new Error('NetSuite token response missing access_token');
  }

  const expiresIn = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + Math.max(60, expiresIn - 120) * 1000
  };
}

async function getNetsuiteAccessToken() {
  const cfg = getNetsuiteConfig();
  if (!cfg.clientId || !cfg.certificateId || !cfg.privateKeyPem || !cfg.tokenUrl) {
    throw new Error('NetSuite OAuth: missing NETSUITE_CLIENT_ID, CERTIFICATE_ID, PRIVATE_KEY or TOKEN_URL');
  }

  if (cache.accessToken && Date.now() < cache.expiresAtMs) {
    return cache.accessToken;
  }

  const next = await fetchNewAccessToken(cfg);
  cache = next;
  return next.accessToken;
}

function clearTokenCache() {
  cache = { accessToken: null, expiresAtMs: 0 };
}

module.exports = {
  getNetsuiteAccessToken,
  clearTokenCache
};
