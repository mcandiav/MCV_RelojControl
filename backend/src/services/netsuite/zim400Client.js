const axios = require('axios');
const { getNetsuiteAccessToken } = require('./oauthToken');
const { getNetsuiteConfig } = require('./config');

function recordTypePath(raw) {
  const v = String(raw || '').trim();
  return v.toLowerCase();
}

function extractIdFromHref(href, recordType) {
  const rx = new RegExp(`/${recordType}/([^/?#]+)`, 'i');
  const m = String(href || '').match(rx);
  return m && m[1] ? String(m[1]) : null;
}

async function createZim400Record(payload) {
  const cfg = getNetsuiteConfig();
  if (!cfg.recordApiBaseUrl) throw new Error('recordApiBaseUrl no disponible');
  const recordType = String(process.env.NETSUITE_ZIM400_RECORD_TYPE || 'customrecord_zim_data_reloj_control').trim();
  const token = await getNetsuiteAccessToken();
  const url = `${cfg.recordApiBaseUrl}/${recordTypePath(recordType)}`;
  const { data, headers, status, statusText } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'transient'
    },
    timeout: 120000
  });
  const idByData = data && data.id != null ? String(data.id) : null;
  const idByHref = extractIdFromHref(data && data.href, recordType);
  const idByLocation = extractIdFromHref(headers && headers.location, recordType);
  return {
    id: idByData || idByHref || idByLocation || null,
    account_id: cfg.accountId || null,
    request_url: url,
    location_header: headers && headers.location ? String(headers.location) : null,
    response_href: data && data.href ? String(data.href) : null,
    data,
    http_status: status,
    status_text: statusText || null
  };
}

module.exports = {
  createZim400Record
};
