// SMS framework. Every SMS in the app goes through queueSms(); a provider adapter turns it into the
// HTTP request (or AWS SDK call) the vendor expects. With no provider connected, messages wait in the
// queue as QUEUED_NO_GATEWAY and OTPs are shown on screen in the test build. Connecting a vendor =
// pick the provider, fill its settings, add DLT template IDs, run a test, switch to Live.
// The same adapters exist server-side in services/sms (that is where secrets live and requests are sent).

export const PURPOSES = [
  ['OTP', 'One-time code', '{{code}} is your {{school}} verification code. Valid 10 minutes. Do not share.'],
  ['FEE_REMINDER', 'Fee reminder', '{{school}}: Fee of {{amount}} for {{student}} is due {{date}}. Pay: {{link}}'],
  ['PICKUP_NOTICE', 'Pickup / drop change', '{{school}}: {{student}} will not take the bus ({{trip}}) on {{date}}. Reason: {{reason}}.'],
  ['GATE_CODE', 'Early leave gate code', '{{school}}: Early leave for {{student}} at {{time}} approved. Gate code {{code}}. Collector: {{collector}}.'],
  ['ABSENT_ALERT', 'Absence alert', '{{school}}: {{student}} is marked absent today ({{date}}). Contact the class coordinator if this is wrong.']
];

export const PROVIDERS = {
  NONE: { name: 'Not connected', fields: [] },
  CUSTOM_HTTP: { name: 'Our own SMS API (custom HTTP)', fields: [['url', 'Endpoint URL (https)'], ['method', 'Method (POST/GET)'], ['authHeader', 'Auth header name'], ['secretRef', 'Secret reference (AWS Secrets Manager ARN)'], ['bodyTemplate', 'Body template (JSON with {{to}}, {{message}}, {{template_id}}, {{sender}}, {{entity_id}})']] },
  MSG91: { name: 'MSG91 (Flow API v5)', fields: [['secretRef', 'Auth key — Secrets Manager ARN'], ['sender', 'Sender ID (6 letters, DLT header)']] },
  AWS_SNS: { name: 'Amazon SNS', fields: [['region', 'AWS region (e.g. ap-south-1)'], ['sender', 'Sender ID'], ['entityId', 'DLT principal entity ID']] },
  GUPSHUP: { name: 'Gupshup Enterprise SMS', fields: [['userId', 'User ID'], ['secretRef', 'Password — Secrets Manager ARN'], ['entityId', 'DLT principal entity ID'], ['sender', 'Sender ID']] },
  TWILIO: { name: 'Twilio', fields: [['accountSid', 'Account SID'], ['secretRef', 'Auth token — Secrets Manager ARN'], ['messagingServiceSid', 'Messaging Service SID']] }
};

export const fill = (text, vars) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
const e164 = (mobile) => '+91' + String(mobile).replace(/\D/g, '').slice(-10);

// Request the vendor expects. Secrets are referenced, never stored in the browser or the database.
export function buildRequest(cfg, msg) {
  const tpl = cfg.templates?.[msg.purpose] || {};
  const to = e164(msg.to);
  switch (cfg.provider) {
    case 'MSG91':
      return { method: 'POST', url: 'https://control.msg91.com/api/v5/flow/', headers: { authkey: `<secret:${cfg.secretRef || 'not set'}>`, 'content-type': 'application/json', accept: 'application/json' },
        body: { template_id: tpl.vendorTemplateId || '<flow id>', short_url: '0', recipients: [{ mobiles: to.slice(1), ...msg.vars }] } };
    case 'AWS_SNS':
      return { sdk: 'SNS.Publish', region: cfg.region || 'ap-south-1', params: { PhoneNumber: to, Message: msg.text, MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: cfg.sender || '' },
        'AWS.MM.SMS.EntityId': { DataType: 'String', StringValue: cfg.entityId || '' },
        'AWS.MM.SMS.TemplateId': { DataType: 'String', StringValue: tpl.dltId || '' } } } };
    case 'GUPSHUP':
      return { method: 'POST', url: 'https://enterprise.smsgupshup.com/GatewayAPI/rest', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: { method: 'SendMessage', send_to: to.slice(1), msg: msg.text, msg_type: 'TEXT', userid: cfg.userId || '', auth_scheme: 'plain', password: `<secret:${cfg.secretRef || 'not set'}>`,
          v: '1.1', format: 'json', principalEntityId: cfg.entityId || '', dltTemplateId: tpl.dltId || '', mask: cfg.sender || '' }, note: 'Check parameter names against your Gupshup account documentation' };
    case 'TWILIO':
      return { method: 'POST', url: `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid || '<AccountSid>'}/Messages.json`, auth: `basic ${cfg.accountSid || '<AccountSid>'}:<secret:${cfg.secretRef || 'not set'}>`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: { To: to, MessagingServiceSid: cfg.messagingServiceSid || '', Body: msg.text } };
    case 'CUSTOM_HTTP': {
      const vars = { to, message: msg.text, template_id: tpl.dltId || '', sender: cfg.sender || '', entity_id: cfg.entityId || '', purpose: msg.purpose };
      let body = fill(cfg.bodyTemplate || '{"to":"{{to}}","message":"{{message}}","template_id":"{{template_id}}"}', Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, JSON.stringify(String(v)).slice(1, -1)])));
      try { body = JSON.parse(body); } catch (e) { /* send as text */ }
      return { method: (cfg.method || 'POST').toUpperCase(), url: cfg.url || '<endpoint not set>', headers: { 'content-type': 'application/json', [cfg.authHeader || 'Authorization']: `<secret:${cfg.secretRef || 'not set'}>` }, body };
    }
    default:
      return null;
  }
}

export function configProblems(cfg) {
  const p = [];
  if (!cfg.provider || cfg.provider === 'NONE') return ['Pick a provider'];
  for (const [k, label] of PROVIDERS[cfg.provider].fields) if (!cfg[k] && !['bodyTemplate', 'method', 'authHeader'].includes(k)) p.push(label + ' is missing');
  if (cfg.provider === 'CUSTOM_HTTP' && cfg.url && !/^https:\/\//.test(cfg.url)) p.push('Endpoint must start with https://');
  if (cfg.sender && !/^[A-Z]{6}$/.test(cfg.sender) && cfg.provider !== 'TWILIO') p.push('Sender ID must be 6 capital letters (DLT header)');
  const missing = PURPOSES.filter(([k]) => !cfg.templates?.[k]?.dltId).map(([, n]) => n);
  if (missing.length && cfg.provider !== 'TWILIO') p.push('DLT template ID missing for: ' + missing.join(', '));
  return p;
}

// All SMS go through here
export function queueSms(db, { to, purpose, vars, related, schoolName }) {
  const cfg = db.smsConfig;
  const tpl = cfg.templates?.[purpose]?.text || PURPOSES.find((x) => x[0] === purpose)?.[2] || '{{message}}';
  const text = fill(tpl, { school: schoolName, ...vars });
  const live = cfg.status === 'LIVE';
  const msg = { id: 'S' + (db.smsQueue.length + 1), to, purpose, text, vars, at: new Date().toISOString(), status: live ? 'SENT_TO_PROVIDER' : 'QUEUED_NO_GATEWAY', provider: cfg.provider, attempts: live ? 1 : 0, related };
  db.smsQueue.unshift(msg);
  db.smsQueue = db.smsQueue.slice(0, 300);
  db.outbox.unshift({ id: 'M' + (db.outbox.length + 1), to: '+91 ' + String(to).slice(-10), kind: 'SMS · ' + (PURPOSES.find((x) => x[0] === purpose)?.[1] || purpose), status: live ? 'SENT' : 'NO_EMAIL', at: msg.at, related, subject: 'SMS', body: text });
  return msg;
}

// When a provider goes live, everything still waiting is handed to it (the dispatcher does this server-side)
export function flushQueue(db) {
  let n = 0;
  db.smsQueue.forEach((m) => { if (m.status === 'QUEUED_NO_GATEWAY' && m.purpose !== 'OTP') { m.status = 'SENT_TO_PROVIDER'; m.provider = db.smsConfig.provider; m.attempts += 1; n++; } else if (m.status === 'QUEUED_NO_GATEWAY') m.status = 'EXPIRED'; });
  return n;
}
