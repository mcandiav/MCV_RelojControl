const path = require('path');

function loadEnvFile(filePath) {
  try {
    require('dotenv').config({ path: filePath });
  } catch (_) {
    /* dotenv opcional si node_modules incompleto (p. ej. fallo de build nativo) */
  }
}

loadEnvFile(path.resolve(__dirname, '../../../../.env.local'));
loadEnvFile(path.resolve(__dirname, '../../../../.env'));
loadEnvFile(path.resolve(__dirname, '../../../.env'));

function suitetalkHostname(accountId) {
  const raw = String(accountId || '').trim();
  if (!raw) return '';
  return `${raw.replace(/_/g, '-').toLowerCase()}.suitetalk.api.netsuite.com`;
}

function parseScopeList(raw) {
  if (!raw || !String(raw).trim()) {
    return ['rest_webservices', 'restlets', 'suite_analytics'];
  }
  return String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function getNetsuiteConfig() {
  const accountId = process.env.NETSUITE_ACCOUNT_ID || '';
  const host = suitetalkHostname(accountId);
  const tokenUrl =
    process.env.NETSUITE_TOKEN_URL ||
    (host ? `https://${host}/services/rest/auth/oauth2/v1/token` : '');

  const datasetId = process.env.NETSUITE_DATASET_OUT_ID || '17';
  const datasetResultPath = `/services/rest/query/v1/dataset/${datasetId}/result`;
  const suiteqlUrl = host ? `https://${host}/services/rest/query/v1/suiteql` : '';
  const outSourceType = String(process.env.NETSUITE_OUT_SOURCE_TYPE || 'savedsearch').trim().toLowerCase();
  const outSavedSearchId = String(process.env.NETSUITE_OUT_SAVEDSEARCH_ID || 'customsearch_mcv_cronometro_out').trim();
  const outOnlyInProgressRaw = String(process.env.NETSUITE_OUT_ONLY_IN_PROGRESS || '').trim().toLowerCase();
  const outOnlyInProgress = outOnlyInProgressRaw ? outOnlyInProgressRaw === 'true' : true;

  return {
    clientId: process.env.NETSUITE_CLIENT_ID || '',
    certificateId: process.env.NETSUITE_CERTIFICATE_ID || '',
    privateKeyPem: (process.env.NETSUITE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    accountId,
    tokenUrl,
    suitetalkHost: host,
    datasetId,
    datasetResultUrl: host ? `https://${host}${datasetResultPath}` : '',
    suiteqlUrl,
    outSourceType,
    outSavedSearchId,
    outOnlyInProgress,
    restletInUrl: process.env.NETSUITE_RESTLET_IN_URL || '',
    scope: parseScopeList(process.env.NETSUITE_OAUTH_SCOPE)
  };
}

function isNetsuiteConfigured() {
  const c = getNetsuiteConfig();
  return Boolean(
    c.clientId &&
      c.certificateId &&
      c.privateKeyPem &&
      c.accountId &&
      c.tokenUrl &&
      c.restletInUrl
  );
}

function getNetsuiteConfigStatus() {
  const c = getNetsuiteConfig();
  return {
    account_id_set: Boolean(c.accountId),
    client_id_set: Boolean(c.clientId),
    certificate_id_set: Boolean(c.certificateId),
    private_key_set: Boolean(c.privateKeyPem),
    token_url: c.tokenUrl ? c.tokenUrl : null,
    dataset_result_url: c.datasetResultUrl || null,
    suiteql_url: c.suiteqlUrl || null,
    restlet_in_url_set: Boolean(c.restletInUrl),
    dataset_id: c.datasetId || null,
    out_source_type: c.outSourceType || null,
    out_savedsearch_id: c.outSavedSearchId || null,
    out_only_in_progress: Boolean(c.outOnlyInProgress),
    oauth_scope: c.scope,
    ready: isNetsuiteConfigured()
  };
}

module.exports = {
  getNetsuiteConfig,
  isNetsuiteConfigured,
  getNetsuiteConfigStatus,
  suitetalkHostname
};
