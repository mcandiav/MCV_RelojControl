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
  const recordApiBaseUrl = host ? `https://${host}/services/rest/record/v1` : '';
  const outSourceType = String(process.env.NETSUITE_OUT_SOURCE_TYPE || 'savedsearch').trim().toLowerCase();
  const outSavedSearchId = String(process.env.NETSUITE_OUT_SAVEDSEARCH_ID || 'customsearch_mcv_cronometro_out').trim();
  const pushMode = String(process.env.NETSUITE_PUSH_MODE || 'import_ot').trim().toLowerCase();
  const importOtRecordType = String(process.env.NETSUITE_IMPORT_OT_RECORD_TYPE || 'customrecord_3k_importacion_ot').trim();
  const importOtJsonField = String(process.env.NETSUITE_IMPORT_OT_JSON_FIELD || 'custrecord_3k_imp_ot_json').trim();
  const importOtWorkOrderField = String(process.env.NETSUITE_IMPORT_OT_WORKORDER_FIELD || 'custrecord_3k_ot_principal').trim();
  const importOtDateField = String(process.env.NETSUITE_IMPORT_OT_DATE_FIELD || 'custrecord_3k_imp_ot_fecha').trim();
  const wocRunField = String(process.env.NETSUITE_WOC_RUN_FIELD || 'machineRunTime').trim();
  const wocSetupField = String(process.env.NETSUITE_WOC_SETUP_FIELD || 'machineSetupTime').trim();
  const wocCompletedQtyField = String(process.env.NETSUITE_WOC_COMPLETED_QTY_FIELD || 'completedQuantity').trim();

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
    recordApiBaseUrl,
    outSourceType,
    outSavedSearchId,
    pushMode,
    restletInUrl: process.env.NETSUITE_RESTLET_IN_URL || '',
    importOtRecordType,
    importOtJsonField,
    importOtWorkOrderField,
    importOtDateField,
    wocRunField,
    wocSetupField,
    wocCompletedQtyField,
    scope: parseScopeList(process.env.NETSUITE_OAUTH_SCOPE)
  };
}

function isNetsuiteConfigured() {
  const c = getNetsuiteConfig();
  const pushReady =
    c.pushMode === 'restlet'
      ? Boolean(c.restletInUrl)
      : c.pushMode === 'workorder_completion'
        ? Boolean(c.recordApiBaseUrl)
        : Boolean(c.recordApiBaseUrl && c.importOtRecordType && c.importOtJsonField && c.importOtWorkOrderField);
  return Boolean(
    c.clientId &&
      c.certificateId &&
      c.privateKeyPem &&
      c.accountId &&
      c.tokenUrl &&
      pushReady
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
    record_api_base_url: c.recordApiBaseUrl || null,
    restlet_in_url_set: Boolean(c.restletInUrl),
    push_mode: c.pushMode || null,
    import_ot_record_type: c.importOtRecordType || null,
    import_ot_json_field: c.importOtJsonField || null,
    import_ot_workorder_field: c.importOtWorkOrderField || null,
    import_ot_date_field: c.importOtDateField || null,
    woc_run_field: c.wocRunField || null,
    woc_setup_field: c.wocSetupField || null,
    woc_completed_qty_field: c.wocCompletedQtyField || null,
    dataset_id: c.datasetId || null,
    out_source_type: c.outSourceType || null,
    out_savedsearch_id: c.outSavedSearchId || null,
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
