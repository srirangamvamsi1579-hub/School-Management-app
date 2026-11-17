// Public pages a school puts on its own website — no sign-in needed.
import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Field, Input, Select } from '../components/ui.jsx';
import { tenantOf } from '../lib/logic.js';
import { addEnquiry } from '../lib/analytics.js';
import { findUser, sendOtp, checkOtp, idType, normId } from '../lib/auth.js';
import { deleteAccount } from './Account.jsx';

const Frame = ({ children }) => { const { db } = useStore(); const t = tenantOf(db); return <div className="login"><main className="box" style={{ maxWidth: 760 }}>
  <div className="row" style={{ gap: 12, marginBottom: 12 }}><div className="logo" style={{ width: 40, height: 40 }}>{t.name[0]}</div><div className="b">{t.name}</div><span className="sp" /><a className="small" href="#/">Sign in</a></div>{children}</main></div>; };

// Privacy policy (linked from the app, the store listings and the website)
export function PrivacyPolicy() {
  const { db } = useStore(); const t = tenantOf(db);
  return <Frame><h1>Privacy policy</h1><p className="small muted">For the {t.name} app and website, run for the school by YourApp. Draft for the school's legal review.</p>
    <h2>What we collect and why</h2><ul>
      <li><b>Account:</b> name, email or mobile, password (stored only as a salted hash) — to sign you in.</li>
      <li><b>Your child's school records:</b> class, attendance, fees, results, bus route — shown to you and to school staff whose role needs them.</li>
      <li><b>Requests you send:</b> leave, pickup, meetings, documents — sent to the coordinators, teachers, office or bus team who act on them.</li>
      <li><b>People you authorise to collect your child:</b> name, mobile, photo and the last 4 digits of their photo ID — shown to the gate staff only.</li>
      <li><b>Device:</b> a notification token if you turn notifications on. No location, contacts, advertising ID or tracking.</li></ul>
    <h2>Who sees it</h2><p>Only staff of your child's school, according to their role, and YourApp support under contract. Data is never sold or used for advertising. Each school's data is kept separate from every other school's.</p>
    <h2>Where it is kept</h2><p>On servers in India (AWS Mumbai), encrypted in transit and at rest.</p>
    <h2>Your choices</h2><p>You can correct your details in My Account, turn notifications off, and delete your account in the app (My Account → Delete my account) or on the web at <a href="#/p/delete">{t.subdomain}.yourapp.com/#/p/delete</a>. Records the school must keep by law (fee receipts, report cards) are kept without your contact details.</p>
    <h2>Children</h2><p>The app is for parents and school staff. Children do not create accounts.</p>
    <h2>Contact</h2><p>The school office, or privacy@yourapp.example.com.</p></Frame>;
}

// Account deletion on the web (Google Play needs a web link that works without the app)
export function DeleteAccountRequest() {
  const { db, run } = useStore(); const t = tenantOf(db);
  const [id, setId] = useState(''); const [sent, setSent] = useState(null); const [code, setCode] = useState(''); const [msg, setMsg] = useState(''); const [done, setDone] = useState(false);
  const send = () => { const u = findUser(db, id.trim()); if (!u || u.status === 'DELETED') { setMsg('No account with that email or mobile.'); return; }
    const r = run((d) => sendOtp(d, { to: normId(id.trim()), channel: idType(id.trim()) === 'MOBILE' ? 'SMS' : 'EMAIL', purpose: 'DELETE', schoolName: t.name })); setSent(r); setMsg(''); };
  const confirm = () => { const err = run((d) => { const e = checkOtp(d, { to: sent.to, purpose: 'DELETE', code }); if (e) return e; const u = findUser(d, id.trim());
      if (u.role === 'PARENT') deleteAccount(d, u.id, 'Owner (web)'); else { d.accountRequests = d.accountRequests || []; d.accountRequests.unshift({ id: 'AR' + (d.accountRequests.length + 1), userId: u.id, type: 'DELETE', detail: 'web', status: 'Pending', at: new Date().toISOString() }); } return null; });
    if (err) setMsg(err); else setDone(true); };
  return <Frame><h1>Delete your account</h1>
    {done ? <p role="status">Done. A parent account is deleted straight away; a staff account is closed by the school office within 7 days. Records the school must keep by law stay with the school without your contact details.</p> : <>
      <p>Enter the email or mobile you sign in with. We send a code to prove it is you.</p>
      <div className="form" style={{ gridTemplateColumns: '1fr' }}><Field label="Email or mobile"><Input value={id} disabled={!!sent} onChange={(e) => setId(e.target.value)} autoComplete="username" /></Field>
        {sent && <Field label="6-digit code"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>}</div>
      {sent && <p className="small muted">Test build: the code is {sent.code}.</p>}
      {msg && <div className="note warn" role="alert">{msg}</div>}
      <div className="row" style={{ marginTop: 12 }}>{sent ? <button className="btn danger" disabled={code.length !== 6} onClick={confirm}>Delete my account</button> : <button className="btn pri" disabled={!id} onClick={send}>Send code</button>}</div></>}
  </Frame>;
}

const blank = { first: '', last: '', gender: 'F', dob: '', grade: '1', prevSchool: '', parent: '', mobile: '', email: '', transport: false, consent: false, website: '' };

export function PublicEnquiry({ embed }) {
  const { db, run } = useStore();
  const t = tenantOf(db);
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (f.website) { setDone({ no: '—' }); return; }                     // hidden field: filled only by spam bots
    const probs = [];
    if (!f.first.trim() || !f.last.trim()) probs.push("child's first and last name");
    if (!f.dob) probs.push('date of birth');
    if (!f.parent.trim()) probs.push("parent's name");
    if (!/^[6-9]\d{9}$/.test(f.mobile)) probs.push('a 10-digit mobile number');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) probs.push('a valid email (or leave it blank)');
    if (!f.consent) probs.push('your consent for the school to contact you');
    if (probs.length) { setErr('Please add ' + probs.join(', ') + '.'); return; }
    const r = run((d) => addEnquiry(d, { ...f, source: 'School website' }, 'Website form'));
    setDone(r); setErr('');
  };
  const body = done ? (
    <div role="status"><h2>Thank you</h2><p>Your enquiry has reached the admissions office of {t.name}.</p>{done.no !== '—' && <p>Reference: <b>{done.no}</b>. We will call you on the number you gave{f.email ? ' and email a copy' : ''}.</p>}
      <button className="btn" onClick={() => { setF(blank); setDone(null); }}>Send another enquiry</button></div>
  ) : (
    <form onSubmit={submit} noValidate>
      <h2 style={{ marginTop: 0 }}>Admission enquiry · {t.name}</h2>
      <p className="small muted">Academic year 2027-28. It takes about two minutes. The admissions office will call you back.</p>
      <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <Field label="Child's first name" req><Input autoComplete="off" value={f.first} onChange={set('first')} /></Field>
        <Field label="Child's last name" req><Input autoComplete="off" value={f.last} onChange={set('last')} /></Field>
        <Field label="Gender"><Select value={f.gender} onChange={set('gender')} options={[['F', 'Girl'], ['M', 'Boy'], ['O', 'Prefer not to say']]} /></Field>
        <Field label="Date of birth" req><Input type="date" value={f.dob} onChange={set('dob')} /></Field>
        <Field label="Grade applying for"><Select value={f.grade} onChange={set('grade')} options={Array.from({ length: 12 }, (_, i) => [String(i + 1), 'Grade ' + (i + 1)])} /></Field>
        <Field label="Current school (if any)"><Input value={f.prevSchool} onChange={set('prevSchool')} /></Field>
        <Field label="Parent's name" req><Input autoComplete="name" value={f.parent} onChange={set('parent')} /></Field>
        <Field label="Mobile" req><Input inputMode="numeric" autoComplete="tel-national" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Email (optional)"><Input type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
      </div>
      <div style={{ position: 'absolute', left: -9999 }} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
      <label className="row small" style={{ marginTop: 10 }}><input type="checkbox" checked={f.transport} onChange={set('transport')} />We would like school transport</label>
      <label className="row small" style={{ marginTop: 6 }}><input type="checkbox" checked={f.consent} onChange={set('consent')} />I agree that {t.name} may contact me about this enquiry. My details are used only for admissions.</label>
      {err && <div className="note warn" role="alert" style={{ marginTop: 10 }}>{err}</div>}
      <div className="row" style={{ marginTop: 14 }}><button className="btn pri" type="submit">Send enquiry</button></div>
    </form>
  );
  if (embed) return <main style={{ padding: 16 }}>{body}</main>;
  return <div className="login"><main className="box" style={{ maxWidth: 760 }}>
    <div className="row" style={{ gap: 12, marginBottom: 12 }}><div className="logo" style={{ width: 40, height: 40 }}>{t.name[0]}</div><div className="b">{t.name}</div><span className="sp" /><a className="small" href="#/">Parent / staff sign-in</a></div>
    {body}</main></div>;
}
