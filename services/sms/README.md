# SMS service

The app already sends every SMS (OTP, gate code, pickup/drop notice, fee reminder, absence alert) through one queue. Until a provider is connected, messages wait as `QUEUED` (in the test build: `QUEUED_NO_GATEWAY`) and OTPs are shown on screen for testing.

## Connect a provider (no code change)

1. Register the sender ID (6 letters), the principal entity and each template on a DLT portal (Jio, Airtel, Vi or BSNL).
2. Put the vendor key or password in AWS Secrets Manager.
3. In the app: **Operations → SMS Gateway**.
   - Pick the provider and fill in its settings, with the secret's ARN (never the key itself).
   - Enter the DLT template ID for each message. The text must match the DLT template exactly.
   - Run a dry run, then **Go live**.
4. On go-live, queued messages are sent. Queued OTPs expire instead.

| Provider | How it sends |
| --- | --- |
| Our own SMS API | Any HTTPS endpoint. You set the method, auth header and a JSON body template with `{{to}}`, `{{message}}`, `{{template_id}}`, `{{sender}}` and `{{entity_id}}`. |
| MSG91 | `POST https://control.msg91.com/api/v5/flow/` with an `authkey` header, `template_id` (flow id) and `recipients`. |
| Amazon SNS | `Publish` with `AWS.SNS.SMS.SenderID`, `AWS.MM.SMS.EntityId` and `AWS.MM.SMS.TemplateId` message attributes (needed for India). |
| Gupshup Enterprise | Gateway REST API with principal entity ID and DLT template ID. Check the parameter names against your account documentation. |
| Twilio | Messages API with a Messaging Service SID. |

Adding another vendor means one more case in `buildRequest()` in `app/src/lib/sms.js`, plus a delivery-report mapping in `webhook.mjs`.

## Files

| File | Purpose |
| --- | --- |
| `app/src/lib/sms.js` | Provider adapters, template filling, config checks, queue. Shared by the app and this service. |
| `dispatcher.mjs` | Lambda that sends queued SMS for schools whose gateway is LIVE. It retries up to 5 times and records the provider message id. |
| `webhook.mjs` | Maps delivery reports from each vendor to DELIVERED / FAILED. |
| `database/008_requests_transport_sms.sql` | Tables `sms_gateway_config` (extended), `sms_templates`, `sms_outbox`, `sms_delivery_reports`. |
