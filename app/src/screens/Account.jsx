import { useState } from 'react';
import { deleteAccount } from '../lib/users.js';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Switch, Modal, Status } from '../components/ui.jsx';
import { dmon } from '../lib/format.js';
import { tenantOf, log, fullName, classLabel } from '../lib/logic.js';
import { idType, normId, findUser, sendOtp, checkOtp, passwordProblems, hashPassword, setPassword, roleName } from '../lib/auth.js';
import { PROVIDERS, PURPOSES, buildRequest, configProblems, fill, flushQueue } from '../lib/sms.js';
import { teacherPerformance } from '../lib/analytics.js';

// ---------- My Account: everyone maintains their own details ----------
export function MyAccount() {
  const { db, run, notify, session, logout } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const school = tenantOf(db).name;
  const [name, setName] = useState(me?.name || '');
  const [chg, setChg] = useState(null);        // { field: 'email'|'mobile', value, sent }
  const [code, setCode] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [link, setLink] = useState('');
  const [del, setDel] = useState(false);
  const [err, setErr] = useState('');
  if (!me) return <Page title="My account"><Card><p>You're using a demo quick-access sign-in, which has no account. Sign in with a demo account (e.g. rohit.s@example.com / Demo@123) to manage account details.</p></Card></Page>;
  const prefs = me.prefs || { email: true, sms: true, app: true };
  const pending = (db.accountRequests || []).filter((r) => r.userId === me.id && r.status === 'Pending');
  const kids = (me.children || []).map((c) => db.students.find((s) => s.admNo === c)).filter(Boolean);

  const startChange = () => {
    const v = chg.value.trim();
    if ((chg.field === 'email' && idType(v) !== 'EMAIL') || (chg.field === 'mobile' && idType(v) !== 'MOBILE')) { setErr(chg.field === 'email' ? 'Enter a valid email' : 'Enter a 10-digit mobile'); return; }
    const other = findUser(db, v); if (other && other.id !== me.id) { setErr('Another account already uses this'); return; }
    const req = run((d) => sendOtp(d, { to: normId(v), channel: chg.field === 'email' ? 'EMAIL' : 'SMS', purpose: 'CHANGE', schoolName: school }));
    setChg({ ...chg, sent: req }); setErr('');
  };
  const confirmChange = () => {
    const v = normId(chg.value);
    const e = run((d) => checkOtp(d, { to: v, purpose: 'CHANGE', code })); if (e) { setErr(e); return; }
    run((d) => { const u = d.users.find((x) => x.id === me.id); if (chg.field === 'email') { if (u.loginType === 'EMAIL') u.login = v; u.email = v; } else { if (u.loginType === 'MOBILE') u.login = v; u.mobile = v; } log(d, u.name, 'Contact changed', chg.field); });
    notify(`${chg.field === 'email' ? 'Email' : 'Mobile'} updated`); setChg(null); setCode(''); setErr('');
  };
  const savePw = () => {
    if (me.pw !== hashPassword(pw.cur, me.salt)) { setErr('Current password is wrong'); return; }
    const p = passwordProblems(pw.next, me.name); if (p.length) { setErr('New password needs ' + p.join(', ')); return; }
    if (pw.next !== pw.again) { setErr("New passwords don't match"); return; }
    run((d) => { const u = d.users.find((x) => x.id === me.id); setPassword(d, u, pw.next); log(d, u.name, 'Password changed', u.login); });
    notify('Password changed'); setPw({ cur: '', next: '', again: '' }); setErr('');
  };
  // Parents created their own accounts, so they can delete them themselves (Google Play and App Store rule)
  const selfDelete = me?.role === 'PARENT';
  const [delPw, setDelPw] = useState('');
  const deleteNow = () => {
    if (me.pw !== hashPassword(delPw, me.salt)) { setErr('Password is not correct'); return; }
    run((d) => { const school = tenantOf(d).name; const email = me.email;
      if (email) d.outbox.unshift({ id: 'M' + (d.outbox.length + 1), to: email, kind: 'Account deleted', status: 'SENT', at: new Date().toISOString(), subject: `${school}: your account has been deleted`, body: '<p>Your account and contact details have been deleted as you asked. Records the school must keep by law stay with the school.</p>' });
      deleteAccount(d, me.id, me.name + ' (self)', { self: true }); log(d, 'Account holder', 'Account deleted by its owner', me.id); });
    setDel(false); logout(); notify('Your account has been deleted');
  };
  const request = (type, detail) => { run((d) => { d.accountRequests = d.accountRequests || []; d.accountRequests.unshift({ id: 'AR' + (d.accountRequests.length + 1), userId: me.id, type, detail, status: 'Pending', at: new Date().toISOString() }); log(d, me.name, 'Account request', `${type} ${detail}`); }); notify('Sent to the school office'); };

  return (
    <Page title="My account" sub="Keep your details up to date. Changes to your email or mobile are confirmed with a one-time code.">
      <div className="grid g2">
        <Card title="Profile">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="row end" style={{ marginTop: 8 }}><button className="btn" disabled={name.trim().length < 2 || name === me.name} onClick={() => { run((d) => { d.users.find((x) => x.id === me.id).name = name.trim(); }); notify('Name saved'); }}>Save name</button></div>
          <table className="t" style={{ marginTop: 10 }}><tbody>
            <tr><td className="muted">Sign-in ID</td><td>{me.login}</td><td /></tr>
            <tr><td className="muted">Email (Gmail)</td><td>{me.email || '—'}</td><td><button className="btn sm" onClick={() => { setChg({ field: 'email', value: me.email || '' }); setErr(''); }}>Change</button></td></tr>
            <tr><td className="muted">Mobile</td><td>{me.mobile || '—'}</td><td><button className="btn sm" onClick={() => { setChg({ field: 'mobile', value: me.mobile || '' }); setErr(''); }}>Change</button></td></tr>
            <tr><td className="muted">Access</td><td colSpan={2}>{roleName(db, me.role)}{me.designation ? ' · ' + me.designation : ''} <span className="small muted">(set by the school)</span></td></tr>
          </tbody></table>
        </Card>
        <Card title="Password">
          <div className="grid" style={{ gap: 8 }}>
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></Field>
            <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="New password again"><Input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
          </div>
          <div className="row end" style={{ marginTop: 8 }}><button className="btn pri" disabled={!pw.cur || !pw.next} onClick={savePw}>Change password</button></div>
        </Card>
        <Card title="Notifications">
          {[['email', 'Email (Gmail)'], ['sms', 'SMS (when the school has SMS)'], ['app', 'App notifications']].map(([k, l]) => <div key={k} className="row" style={{ marginBottom: 8 }}>
            <Switch on={prefs[k]} label={l} onClick={() => run((d) => { const u = d.users.find((x) => x.id === me.id); u.prefs = { ...prefs, [k]: !prefs[k] }; })} />{l}</div>)}
          <p className="small muted">Safety messages (gate codes, absence alerts, transport changes) are always sent.</p>
        </Card>
        {me.role === 'PARENT' && <Card title="My children">
          {kids.map((s) => <div key={s.id} className="small" style={{ padding: '4px 0' }}><b>{fullName(s)}</b> · {classLabel(db, s)} · {s.admNo}</div>)}
          <div className="row" style={{ marginTop: 10 }}><Input placeholder="Another child's admission no." value={link} onChange={(e) => setLink(e.target.value.toUpperCase())} />
            <button className="btn" disabled={!/^ADM-\d{4}-\d{4}$/.test(link)} onClick={() => { request('LINK_CHILD', link); setLink(''); }}>Ask to link</button></div>
          <p className="small muted">The school checks and links siblings to your account.</p>
        </Card>}
        <Card title="Delete my account">
          {selfDelete ? <p className="small">Deletes your sign-in and your contact details straight away. Records the school must keep by law (fee receipts, report cards) stay with the school without your contact details.</p>
            : <p className="small">Staff accounts are managed by the school. Your request goes to the school office, which closes the account and tells you by email.</p>}
          {pending.length > 0 && <div className="note small">Waiting for the school: {pending.map((r) => r.type === 'DELETE' ? 'account closure' : 'link ' + r.detail).join(', ')}</div>}
          <button className="btn danger" disabled={pending.some((r) => r.type === 'DELETE')} onClick={() => { setDelPw(''); setDel(true); }}>{selfDelete ? 'Delete my account' : 'Ask to close my account'}</button>
        </Card>
      </div>
      {chg && <Modal title={`Change ${chg.field}`} onClose={() => setChg(null)} actions={chg.sent ? <button className="btn pri" disabled={code.length !== 6} onClick={confirmChange}>Confirm</button> : <button className="btn pri" onClick={startChange}>Send code</button>}>
        <Field label={chg.field === 'email' ? 'New email (Gmail)' : 'New mobile'}><Input value={chg.value} disabled={!!chg.sent} onChange={(e) => setChg({ ...chg, value: e.target.value })} /></Field>
        {chg.sent && <div style={{ marginTop: 10 }}>
          <p className="small">{chg.sent.channel === 'SMS' ? (chg.sent.status === 'GATEWAY_PENDING' ? <>SMS isn't connected yet, so the code is shown here for testing: <b>{chg.sent.code}</b></> : 'We sent a code by SMS.') : <>We sent a code to <b>{chg.sent.to}</b> (see Settings → Email & SMS Outbox in the test build). Test code: <b>{chg.sent.code}</b></>}</p>
          <Field label="6-digit code"><Input maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field></div>}
        {err && <div className="note warn" style={{ marginTop: 8 }}>{err}</div>}
      </Modal>}
      {del && (selfDelete ? <Modal title="Delete your account?" onClose={() => setDel(false)} actions={<button className="btn danger" disabled={!delPw} onClick={deleteNow}>Delete permanently</button>}>
        <p>This cannot be undone. You will be signed out on all devices. To use the app again you would create a new account.</p>
        <Field label="Enter your password to confirm"><Input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></Field>
        {err && <div className="note warn" role="alert" style={{ marginTop: 8 }}>{err}</div>}</Modal>
        : <Modal title="Close my account?" onClose={() => setDel(false)} actions={<button className="btn danger" onClick={() => { request('DELETE', ''); setDel(false); }}>Send request</button>}>
        <p>The school office will close your account and let you know by email. You can keep using the app until then.</p></Modal>)}
      {err && !chg && <div className="note warn" role="alert">{err}</div>}
      <p className="small muted">Signed in since this session started · <button className="btn sm" onClick={logout}>Sign out</button></p>
    </Page>
  );
}

// ---------- SMS gateway settings ----------
export function SmsGateway() {
  const { db, run, notify, session } = useStore();
  const [cfg, setCfg] = useState(structuredClone(db.smsConfig));
  const [preview, setPreview] = useState(null);
  const [testTo, setTestTo] = useState('9845011200');
  const probs = configProblems(cfg);
  const q = db.smsQueue || [];
  const save = (status) => { run((d) => { d.smsConfig = { ...cfg, status }; if (status === 'LIVE') { const n = flushQueue(d); log(d, session.name || session.role, 'SMS gateway live', `${cfg.provider} · ${n} queued messages handed over`); } else log(d, session.name || session.role, 'SMS settings saved', cfg.provider); }); notify(status === 'LIVE' ? 'Live — new SMS go to the provider' : 'Saved'); };
  const test = () => { const msg = { to: testTo, purpose: 'OTP', vars: { code: '123456' }, text: fill(cfg.templates.OTP.text, { code: '123456', school: tenantOf(db).name }) }; setPreview(buildRequest(cfg, msg)); run((d) => { d.smsConfig.tests = [{ at: new Date().toISOString(), provider: cfg.provider, ok: !configProblems(cfg).length }, ...(d.smsConfig.tests || [])].slice(0, 5); }); };
  const field = (k, label) => <Field key={k} label={label}>{k === 'bodyTemplate' ? <textarea className="i" value={cfg[k] || ''} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} /> : <Input value={cfg[k] || ''} onChange={(e) => setCfg({ ...cfg, [k]: k === 'sender' ? e.target.value.toUpperCase() : e.target.value })} />}</Field>;
  return (
    <Page title="SMS gateway" sub="The SMS framework is ready: OTPs, gate codes, pickup notices and fee reminders already go through one queue. Connect a vendor (or the school's own SMS API) here when the account is ready — no code change needed."
      actions={<span className={'pill ' + (db.smsConfig.status === 'LIVE' ? 'ok' : 'warn')}>{db.smsConfig.status === 'LIVE' ? 'Live · ' + PROVIDERS[db.smsConfig.provider].name : 'Not connected — SMS are queued'}</span>}>
      <div className="grid g2">
        <Card title="1. Provider">
          <Field label="Send SMS through"><Select value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })} options={Object.entries(PROVIDERS).map(([k, v]) => [k, v.name])} /></Field>
          <div className="grid" style={{ gap: 8, marginTop: 10 }}>{PROVIDERS[cfg.provider].fields.map(([k, l]) => field(k, l))}{cfg.provider !== 'NONE' && cfg.provider !== 'AWS_SNS' && cfg.provider !== 'GUPSHUP' && field('entityId', 'DLT principal entity ID')}</div>
          <p className="small muted" style={{ marginTop: 8 }}>Keys and passwords are kept in AWS Secrets Manager; only the reference (ARN) is saved here. India requires DLT registration of the sender ID and every template.</p>
        </Card>
        <Card title="2. Message templates (DLT)">
          <table className="t"><thead><tr><th>Message</th><th>Text (must match the DLT template exactly)</th><th>DLT template ID</th>{cfg.provider === 'MSG91' && <th>MSG91 flow ID</th>}</tr></thead>
            <tbody>{PURPOSES.map(([k, name]) => <tr key={k}><td className="small b">{name}</td><td><textarea className="i" style={{ minHeight: 54, fontSize: 11 }} value={cfg.templates[k].text} onChange={(e) => setCfg({ ...cfg, templates: { ...cfg.templates, [k]: { ...cfg.templates[k], text: e.target.value } } })} /></td>
              <td><Input style={{ width: 150 }} value={cfg.templates[k].dltId} onChange={(e) => setCfg({ ...cfg, templates: { ...cfg.templates, [k]: { ...cfg.templates[k], dltId: e.target.value.replace(/\D/g, '') } } })} /></td>
              {cfg.provider === 'MSG91' && <td><Input style={{ width: 120 }} value={cfg.templates[k].vendorTemplateId} onChange={(e) => setCfg({ ...cfg, templates: { ...cfg.templates, [k]: { ...cfg.templates[k], vendorTemplateId: e.target.value } } })} /></td>}</tr>)}</tbody></table>
        </Card>
        <Card title="3. Test and go live">
          {probs.length > 0 && <ul className="small" style={{ color: 'var(--warn)', marginTop: 0 }}>{probs.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="row"><Input value={testTo} onChange={(e) => setTestTo(e.target.value)} style={{ width: 140 }} /><button className="btn" disabled={cfg.provider === 'NONE'} onClick={test}>Dry run: build the request</button></div>
          <p className="small muted">The test build can't reach the internet, so a dry run shows exactly what will be sent. In production “Send test SMS” sends one real message through the provider and records the delivery report.</p>
          <div className="row end" style={{ marginTop: 10 }}><button className="btn" onClick={() => save('NOT_CONNECTED')}>Save (stay queued)</button><button className="btn pri" disabled={probs.length > 0} onClick={() => save('LIVE')}>Go live</button></div>
        </Card>
        <Card title={`Queue (${q.length})`} right={<span className="small muted">{q.filter((m) => m.status === 'QUEUED_NO_GATEWAY').length} waiting for a provider</span>}>
          <div className="tw" style={{ maxHeight: 280 }}><table className="t"><thead><tr><th>When</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>{q.length === 0 ? <tr><td colSpan={4} className="muted">Nothing yet.</td></tr> : q.slice(0, 50).map((m) => <tr key={m.id}><td className="small">{dmon(m.at)}</td><td className="small">{m.to}</td><td className="small">{m.purpose === 'OTP' ? m.text.replace(/\d{6}/, '••••••') : m.text}</td><td><span className={'pill ' + (m.status === 'SENT_TO_PROVIDER' ? 'ok' : m.status === 'EXPIRED' ? '' : 'warn')}>{m.status.replace(/_/g, ' ').toLowerCase()}</span></td></tr>)}</tbody></table></div>
          <p className="small muted">When a provider goes live, queued messages are sent; queued OTPs expire instead (they're only valid 10 minutes).</p>
        </Card>
      </div>
      {preview && <Modal title="Request that would be sent" onClose={() => setPreview(null)}><pre className="small" style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: 12, borderRadius: 8 }}>{JSON.stringify(preview, null, 2)}</pre></Modal>}
    </Page>
  );
}

// ---------- Teacher's own performance (only when shared) ----------
export function MyPerformance() {
  const { db, session } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const staffId = me?.staffId || 'E1';
  if (!db.settings.teacherPerfShared) return <Page title="My teaching performance"><Card><p>Not shared with teachers at the moment.</p></Card></Page>;
  const rows = teacherPerformance(db, {}).filter((r) => r.teacherId === staffId);
  return <Page title="My teaching performance" sub={`View only. Shared by ${db.settings.teacherPerfBy || 'the Principal'}. You see your own classes only; other teachers' results are not shown.`}>
    {rows.length === 0 ? <Card><p>No marks for your classes yet.</p></Card> : <div className="tw"><table className="t"><thead><tr><th>Subject</th><th>Sections</th><th className="num">Students</th><th className="num">Term 1 avg</th><th className="num">Term 2 avg</th><th className="num">Change</th><th className="num">vs grade average</th><th className="num">Pass %</th><th className="num">≥ 75%</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.subject}><td className="b">{r.subject}</td><td className="small">{r.sections}</td><td className="num">{r.students}</td><td className="num">{r.term1}</td><td className="num b">{r.term2}</td>
        <td className="num">{r.change > 0 ? '+' : ''}{r.change}</td><td className="num">{r.vsGrade > 0 ? '+' : ''}{r.vsGrade}</td><td className="num">{r.pass}%</td><td className="num">{r.distinction}%</td></tr>)}</tbody></table></div>}
  </Page>;
}

// ---------- Admin: account requests (closure, linking siblings) ----------
export function AccountRequests() {
  const { db, run, notify, session } = useStore();
  const list = (db.accountRequests || []).filter((r) => r.status === 'Pending');
  const done = (r, ok) => run((d) => {
    const x = d.accountRequests.find((y) => y.id === r.id); x.status = ok ? 'Done' : 'Rejected'; x.by = session.name || session.role;
    const u = d.users.find((y) => y.id === r.userId);
    if (ok && r.type === 'LINK_CHILD') u.children = [...new Set([...(u.children || []), r.detail])];
    if (ok && r.type === 'DELETE') deleteAccount(d, u.id, session.name || session.role, { self: true, reason: 'Asked to close the account' });
    log(d, session.name || session.role, 'Account request ' + x.status.toLowerCase(), `${r.type} · ${u?.login || r.userId}`);
  });
  if (!list.length) return null;
  return <Card title={`Requests from account holders (${list.length})`}>
    <table className="t"><tbody>{list.map((r) => { const u = db.users.find((x) => x.id === r.userId); const kid = r.type === 'LINK_CHILD' && db.students.find((s) => s.admNo === r.detail); return <tr key={r.id}>
      <td className="b">{u?.name}</td><td>{r.type === 'DELETE' ? 'Close account' : `Link child ${r.detail}`}{r.type === 'LINK_CHILD' && <div className="small muted">{kid ? `${fullName(kid)} · ${classLabel(db, kid)}` : 'No student with this number'}</div>}</td><td className="small">{dmon(r.at)}</td>
      <td><div className="row"><button className="btn sm pri" disabled={r.type === 'LINK_CHILD' && !kid} onClick={() => { done(r, true); notify('Done'); }}>{r.type === 'DELETE' ? 'Close account' : 'Link'}</button><button className="btn sm" onClick={() => { done(r, false); notify('Rejected'); }}>Reject</button></div></td></tr>; })}</tbody></table></Card>;
}

// Closing an account archives it first, then removes the sign-in (lib/users.js)
export { deleteAccount };
export { Status };
