const axios = require('axios');
const { getNetsuiteConfig } = require('./config');
const { getNetsuiteAccessToken } = require('./oauthToken');

/**
 * POST batch to MCV_Cronometro_In RESTlet (overwrite actuals on manufacturingoperationtask).
 */
async function pushActualsBatch(items) {
  const cfg = getNetsuiteConfig();
  if (!cfg.restletInUrl) {
    throw new Error('NETSUITE_RESTLET_IN_URL is not set');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  const token = await getNetsuiteAccessToken();
  const { data } = await axios.post(
    cfg.restletInUrl,
    { items },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );

  return data;
}

module.exports = {
  pushActualsBatch
};
