const PIXEL_ID = '1359305889034155';
const GRAPH_URL = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'Contact', 'InitiateCheckout', 'Purchase']);
const STRIPE_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

function cleanString(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function cleanCustomData(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    if (!/^[a-z_]{1,40}$/.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string' && value.length <= 200) out[key] = value;
  }
  return out;
}

function clientIp(headers) {
  const forwarded = headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return first || undefined;
}

function buildEvent(body, headers, nowMs = Date.now()) {
  if (!body || typeof body !== 'object') return null;
  const eventName = body.event_name;
  if (!ALLOWED_EVENTS.has(eventName)) return null;
  const eventId = cleanString(body.event_id, 100);
  if (!eventId) return null;
  if (eventName === 'Purchase' && !STRIPE_SESSION_ID.test(eventId)) return null;
  const sourceUrl = cleanString(body.event_source_url, 2000);
  if (!sourceUrl || !/^https?:\/\//.test(sourceUrl)) return null;

  const userData = {
    client_ip_address: clientIp(headers),
    client_user_agent: cleanString(headers['user-agent'], 1000),
    fbp: cleanString(body.fbp, 200),
    fbc: cleanString(body.fbc, 500)
  };
  for (const key of Object.keys(userData)) if (userData[key] === undefined) delete userData[key];

  return {
    event_name: eventName,
    event_time: Math.floor(nowMs / 1000),
    event_id: eventId,
    event_source_url: sourceUrl,
    action_source: 'website',
    user_data: userData,
    custom_data: cleanCustomData(body.custom_data)
  };
}

function buildRequestBody(event, token, testEventCode) {
  const params = new URLSearchParams();
  params.set('data', JSON.stringify([event]));
  if (testEventCode) params.set('test_event_code', testEventCode);
  params.set('access_token', token);
  return params;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const event = buildEvent(body, req.headers || {});
  if (!event) return res.status(400).end();

  try {
    const response = await fetch(GRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRequestBody(event, token, process.env.META_CAPI_TEST_CODE)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.error('CAPI rejected', event.event_name, response.status, result.error && result.error.message);
      return res.status(502).end();
    }
    return res.status(204).end();
  } catch (e) {
    console.error('CAPI request failed', event.event_name);
    return res.status(502).end();
  }
}

module.exports = handler;
module.exports.buildEvent = buildEvent;
module.exports.buildRequestBody = buildRequestBody;
