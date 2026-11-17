// SMS dispatcher (AWS Lambda, Node 20). Runs every minute from EventBridge and on SQS "sms-outbox" messages.
// Reads QUEUED rows from sms_outbox for schools whose gateway is LIVE, builds the vendor request with the
// same adapters the app uses (app/src/lib/sms.js), sends it, and records the provider's message id.
// Delivery reports arrive at /webhooks/sms/{provider} and update sms_outbox.status (see webhook.mjs).
//
// Environment: DATABASE_URL (Secrets Manager), AWS_REGION. Vendor secrets are read from Secrets Manager by
// the ARN saved in sms_gateway_config.secret_arn — they never reach the browser or the database.
import pg from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { buildRequest } from '../../app/src/lib/sms.js';

const sm = new SecretsManagerClient({});
const secretCache = new Map();
async function secret(arn) {
  if (!arn) return '';
  if (!secretCache.has(arn)) secretCache.set(arn, (await sm.send(new GetSecretValueCommand({ SecretId: arn }))).SecretString);
  return secretCache.get(arn);
}

// Replace "<secret:ARN>" placeholders produced by buildRequest with the real value
async function resolveSecrets(obj) {
  const s = JSON.stringify(obj);
  const arns = [...new Set([...s.matchAll(/<secret:([^>]+)>/g)].map((m) => m[1]))];
  let out = s;
  for (const a of arns) out = out.split(`<secret:${a}>`).join((await secret(a)).replace(/"/g, '\\"'));
  return JSON.parse(out);
}

export async function send(cfg, msg) {
  const req = await resolveSecrets(buildRequest(cfg, msg));
  if (req.sdk === 'SNS.Publish') {
    const r = await new SNSClient({ region: req.region }).send(new PublishCommand(req.params));
    return { ok: true, providerId: r.MessageId };
  }
  const form = (req.headers['content-type'] || '').includes('x-www-form-urlencoded');
  const headers = { ...req.headers };
  if (req.auth?.startsWith('basic ')) headers.authorization = 'Basic ' + Buffer.from(req.auth.slice(6)).toString('base64');
  const url = req.method === 'GET' ? req.url + '?' + new URLSearchParams(req.body) : req.url;
  const res = await fetch(url, { method: req.method, headers, body: req.method === 'GET' ? undefined : form ? new URLSearchParams(req.body) : JSON.stringify(req.body) });
  const text = await res.text();
  return { ok: res.ok, providerId: (text.match(/"(?:request_id|sid|id|message_id)"\s*:\s*"([^"]+)"/) || [])[1] || null, error: res.ok ? null : `${res.status} ${text.slice(0, 300)}` };
}

export async function handler() {
  const db = new pg.Client({ connectionString: await secret(process.env.DATABASE_SECRET_ARN) });
  await db.connect();
  try {
    // Platform service role: works across schools, one school at a time
    const { rows } = await db.query(`SELECT o.*, row_to_json(g) AS cfg FROM sms_outbox o JOIN sms_gateway_config g ON g.tenant_id = o.tenant_id
      WHERE o.status = 'QUEUED' AND g.status = 'LIVE' AND o.attempts < 5 ORDER BY o.created_at LIMIT 200 FOR UPDATE OF o SKIP LOCKED`);
    for (const m of rows) {
      const cfg = { ...m.cfg, provider: m.cfg.provider, templates: (await db.query('SELECT purpose, body AS text, dlt_template_id AS "dltId", vendor_template_id AS "vendorTemplateId" FROM sms_templates WHERE tenant_id = $1', [m.tenant_id])).rows
        .reduce((a, t) => ({ ...a, [t.purpose]: t }), {}), sender: m.cfg.sender_id, entityId: m.cfg.dlt_entity_id, secretRef: m.cfg.secret_arn, url: m.cfg.endpoint_url, method: m.cfg.http_method,
        authHeader: m.cfg.auth_header, bodyTemplate: m.cfg.body_template, region: m.cfg.aws_region, userId: m.cfg.account_user, accountSid: m.cfg.account_user, messagingServiceSid: m.cfg.messaging_service_id };
      let r;
      try { r = await send(cfg, { to: m.destination, purpose: m.purpose, vars: m.vars, text: m.body }); } catch (e) { r = { ok: false, error: String(e).slice(0, 300) }; }
      await db.query(`UPDATE sms_outbox SET status = $2, provider_message_id = $3, last_error = $4, attempts = attempts + 1, sent_at = CASE WHEN $2 = 'SENT' THEN now() END WHERE sms_id = $1`,
        [m.sms_id, r.ok ? 'SENT' : (m.attempts + 1 >= 5 ? 'FAILED' : 'QUEUED'), r.providerId, r.error]);
    }
    return { processed: rows.length };
  } finally { await db.end(); }
}
