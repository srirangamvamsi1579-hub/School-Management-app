// Delivery reports: POST /webhooks/sms/{provider}?tenant={id}&token={per-school webhook token}
// Maps each vendor's report to DELIVERED / FAILED on sms_outbox by provider_message_id.
const MAP = {
  MSG91: (b) => (Array.isArray(b?.data) ? b.data : [b]).map((x) => ({ id: x.requestId || x.request_id, status: /deliver/i.test(x.status || x.desc || '') ? 'DELIVERED' : 'FAILED' })),
  TWILIO: (b) => [{ id: b.MessageSid, status: b.MessageStatus === 'delivered' ? 'DELIVERED' : ['failed', 'undelivered'].includes(b.MessageStatus) ? 'FAILED' : null }],
  GUPSHUP: (b) => [{ id: b.externalId || b.id, status: /SUCCESS|DELIVRD/i.test(b.status || b.cause || '') ? 'DELIVERED' : 'FAILED' }],
  CUSTOM_HTTP: (b) => [{ id: b.id || b.message_id, status: String(b.status || '').toUpperCase() === 'DELIVERED' ? 'DELIVERED' : 'FAILED' }]
};
export function parseReport(provider, body) { return (MAP[provider] || MAP.CUSTOM_HTTP)(body).filter((x) => x.id && x.status); }
// Amazon SNS delivery status comes through CloudWatch Logs → subscription filter → the same table update.
