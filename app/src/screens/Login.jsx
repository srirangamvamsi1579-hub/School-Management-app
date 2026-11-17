import { useState } from 'react';
import { useStore } from '../data/store.js';
import { ROLES, PLANS } from '../data/menu.js';
import { Select, Field, Input, Html, Tabs } from '../components/ui.jsx';
import { idType, normId, isGmail, isEmail, isMobile, normMobile, passwordProblems, findUser, sendOtp, checkOtp, createAccount, accountEmail, signIn, setPassword } from '../lib/auth.js';
import { DESIGNATIONS } from '../data/seed2.js';
import { tenantOf, log } from '../lib/logic.js';

const WHAT = {
  ADMIN: 'Everything for the school: setup, users, templates, data import, branding',
  PRINCIPAL: 'Insights, analytics, admissions, approvals, papers',
  ACCOUNTANT: 'Fees, fee emails, payment matching, payroll, statements',
  TEACHER: 'Attendance, timetable, question papers, grades, top/bottom report',
  FRONT_OFFICE: 'Admissions & enquiries, documents, fee counter',
  PARENT: 'Child profile, pickup / early-leave requests, fee dues and pay, my account',
  TRANSPORT: 'Daily bus manifests, pickup & drop changes, routes',
  PLATFORM: 'Your company: schools, plans, add-ons, switching modules on/off'
};

export default function Login({ next = null }) {
  const { db, mutate } = useStore();
  const [tab, setTab] = useState('signin');
  const [peek, setPeek] = useState('');           // address whose test inbox is shown
  const t = tenantOf(db);
  return (
    <div className="login">
      <div className="box" style={{ maxWidth: 980 }}>
        <div className="row" style={{ gap: 14, marginBottom: 6 }}>
          <div className="logo" style={{ width: 46, height: 46, fontSize: 20 }}>{t.name[0]}</div>
          <div><h1 style={{ margin: 0 }}>{t.name}</h1><div className="muted small">{t.subdomain}.yourapp.com · each school (client) has its own sign-in page and accounts</div></div>
          <span className="sp" /><a className="small" href="#/p/apply">Admission enquiry →</a>
        </div>
        <div className="row small" style={{ margin: '8px 0 14px' }}>
          <span className="muted">Test build — pretend this page is for:</span>
          <Select value={db.tenantId} onChange={(e) => mutate((d) => { d.tenantId = e.target.value; })} options={db.tenants.map((x) => [x.id, `${x.name} (${PLANS.find((p) => p.code === x.plan).name})`])} />
        </div>
        {next && <div className="note" role="status" style={{ marginBottom: 10 }}>Sign in to continue to <b>{next}</b>.</div>}
        <Tabs tabs={[['signin', 'Sign in'], ['signup', 'Create account'], ['demo', 'Demo quick access']]} value={tab} onChange={setTab} />
        <div className={'grid' + (tab === 'demo' ? '' : ' g-side')} style={{ alignItems: 'start' }}>
          {tab === 'signin' && <SignIn onPeek={setPeek} onSignup={() => setTab('signup')} />}
          {tab === 'signup' && <SignUp onPeek={setPeek} onDone={() => setTab('signin')} />}
          {tab === 'demo' && <Demo />}
          {tab !== 'demo' && <TestInbox address={peek} />}
        </div>
      </div>
    </div>
  );
}

// Messages the test build would have sent to this address (Gmail or SMS in production)
function TestInbox({ address }) {
  const { db } = useStore();
  const [open, setOpen] = useState(null);
  const id = address ? normId(address) : '';
  const msgs = id ? db.outbox.filter((m) => m.to === id || m.to === '+91 ' + id).slice(0, 6) : [];
  return (
    <div className="card" style={{ background: 'var(--bg)' }}>
      <h3>Test inbox</h3>
      <p className="small muted">Shows what would arrive in {address ? <b>{address}</b> : 'the Gmail or phone you type'}. In production emails go to Gmail (Amazon SES) and codes to the phone by SMS.</p>
      {msgs.length === 0 ? <p className="small muted">Nothing yet.</p> : msgs.map((m) => (
        <div key={m.id} className="card" style={{ padding: 10, marginBottom: 8, cursor: 'pointer' }} onClick={() => setOpen(open === m.id ? null : m.id)}>
          <div className="small b">{m.subject === 'SMS' ? 'SMS' : m.subject}</div><div className="small muted">{m.kind}</div>
          {open === m.id && (m.subject === 'SMS' ? <p className="small">{m.body}</p> : <Html html={m.body} />)}
        </div>))}
    </div>
  );
}

function SignIn({ onPeek, onSignup }) {
  const { db, run, login, notify } = useStore();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('password');   // password | otp | forgot
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [err, setErr] = useState('');
  const school = tenantOf(db).name;
  const type = idType(id);
  const go = (u) => { login({ role: u.role, userId: u.id, name: u.name }); notify(`Signed in as ${u.name}`); };

  const doPassword = () => { const res = run((d) => { const r = signIn(d, id, pw); if (r.user) log(d, r.user.name, 'Signed in', r.user.login); return r; }); if (res.error) setErr(res.error); else go(res.user); };
  const askCode = (purpose) => {
    const u = findUser(db, id);
    if (!u) { setErr('No account with that email or mobile'); return; }
    const channel = type === 'MOBILE' ? 'SMS' : 'EMAIL';
    const req = run((d) => sendOtp(d, { to: normId(id), channel, purpose, schoolName: school }));
    setSent(req); setErr(''); onPeek(id);
  };
  const doOtp = () => {
    const e = run((d) => checkOtp(d, { to: normId(id), purpose: 'SIGNIN', code }));
    if (e) { setErr(e); return; }
    const u = findUser(db, id);
    if (u.status !== 'ACTIVE') { setErr(u.status === 'PENDING' ? 'Your account is waiting for the school to approve it' : 'Account is ' + u.status.toLowerCase()); return; }
    run((d) => { const x = d.users.find((y) => y.id === u.id); x.lastLogin = new Date().toISOString(); log(d, x.name, 'Signed in with code', x.login); });
    go(u);
  };
  const doReset = () => {
    const e = run((d) => checkOtp(d, { to: normId(id), purpose: 'RESET', code }));
    if (e) { setErr(e); return; }
    const probs = passwordProblems(newPw);
    if (probs.length) { setErr('Password needs ' + probs.join(', ')); return; }
    run((d) => { const u = findUser(d, id); setPassword(d, u, newPw); log(d, u.name, 'Password reset', u.login); });
    notify('Password changed — sign in with the new one'); setMode('password'); setSent(null); setCode(''); setPw(''); setErr('');
  };

  return (
    <div className="card">
      <h2>{mode === 'forgot' ? 'Reset your password' : 'Sign in'}</h2>
      <Field label="Email (Gmail) or mobile number"><Input value={id} autoComplete="username" onChange={(e) => { setId(e.target.value); setErr(''); setSent(null); }} onBlur={() => onPeek(id)} placeholder="name@gmail.com or 98xxxxxxxx" /></Field>
      {mode === 'password' && <>
        <div style={{ height: 10 }} />
        <Field label="Password"><Input type="password" autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && doPassword()} /></Field>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn pri" disabled={!type || !pw} onClick={doPassword}>Sign in</button>
          <button className="btn" disabled={!type} onClick={() => { setMode('otp'); setErr(''); }}>Sign in with a code instead</button>
          <button className="btn" style={{ border: 0 }} disabled={!type} onClick={() => { setMode('forgot'); setErr(''); }}>Forgot password?</button>
        </div>
      </>}
      {(mode === 'otp' || mode === 'forgot') && <>
        {!sent ? <div className="row" style={{ marginTop: 12 }}><button className="btn pri" disabled={!type} onClick={() => askCode(mode === 'otp' ? 'SIGNIN' : 'RESET')}>Send code {type === 'MOBILE' ? 'by SMS' : 'to my email'}</button><button className="btn" onClick={() => setMode('password')}>Back</button></div> : <>
          <p className="small">{sent.channel === 'SMS' ? (sent.status === 'GATEWAY_PENDING' ? <>SMS isn't connected yet (Operations → SMS Gateway), so the code is shown here for testing: <b>{sent.code}</b></> : <>We sent a 6-digit code by SMS to {sent.to}.</>) : <>We sent a 6-digit code to <b>{sent.to}</b>. Open it in the test inbox on the right.</>}</p>
          <Field label="6-digit code"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          {mode === 'forgot' && <div style={{ marginTop: 10 }}><Field label="New password"><Input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field></div>}
          <div className="row" style={{ marginTop: 12 }}><button className="btn pri" disabled={code.length !== 6} onClick={mode === 'otp' ? doOtp : doReset}>{mode === 'otp' ? 'Verify and sign in' : 'Save new password'}</button>
            <button className="btn" onClick={() => askCode(mode === 'otp' ? 'SIGNIN' : 'RESET')}>Send a new code</button><button className="btn" onClick={() => { setMode('password'); setSent(null); }}>Back</button></div>
        </>}
      </>}
      {err && <div className="note warn" style={{ marginTop: 12 }} role="alert">{err}</div>}
      <p className="small" style={{ marginTop: 16 }}>New here? <button className="btn sm" onClick={onSignup}>Create an account</button></p>
      <p className="small muted">Demo accounts use the password <b>Demo@123</b> — e.g. admin@greenvalley.example.in, sonia.teacher@example.com, meera.vp@example.com (Vice Principal) transport@greenvalley.example.in or mobile 9845011200.</p>
    </div>
  );
}

function SignUp({ onPeek, onDone }) {
  const { db, run, notify } = useStore();
  const school = tenantOf(db).name;
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ first: '', last: '', identifier: '', email: '', mobile: '', requestedRole: 'PARENT', admissionNo: '', designation: 'TGT', password: '', confirm: '', agree: false });
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setErr(''); };
  const type = idType(f.identifier);
  const name = `${f.first} ${f.last}`.trim();
  const probs = passwordProblems(f.password, name);

  const next1 = () => { if (!f.first.trim()) return setErr('Enter your first name'); setStep(2); };
  const next2 = () => {
    if (!type) return setErr('Enter a Gmail / email address or a 10-digit Indian mobile number');
    if (findUser(db, f.identifier)) return setErr('An account already uses this — sign in or use “Forgot password”');
    const req = run((d) => sendOtp(d, { to: normId(f.identifier), channel: type === 'MOBILE' ? 'SMS' : 'EMAIL', purpose: 'SIGNUP', schoolName: school }));
    setSent(req); onPeek(f.identifier); setStep(3);
  };
  const next3 = () => { const e = run((d) => checkOtp(d, { to: normId(f.identifier), purpose: 'SIGNUP', code })); if (e) return setErr(e); setStep(4); };
  const next4 = () => { if (probs.length) return setErr('Password needs ' + probs.join(', ')); if (f.password !== f.confirm) return setErr("Passwords don't match"); setStep(5); };
  const finish = () => {
    if (type === 'MOBILE' && f.email && !isEmail(f.email)) return setErr('That email address looks wrong');
    if (f.requestedRole === 'PARENT' && !/^ADM-\d{4}-\d{4}$/i.test(f.admissionNo.trim())) return setErr("Enter your child's admission number, like ADM-2025-0231");
    if (!f.agree) return setErr('Please accept the terms and privacy notice');
    const u = run((d) => {
      const x = createAccount(d, { ...f, name, admissionNo: f.requestedRole === 'PARENT' ? f.admissionNo.trim().toUpperCase() : null, designation: f.requestedRole === 'STAFF' ? f.designation : null,
        requestedRole: f.requestedRole === 'STAFF' ? 'TEACHER' : 'PARENT', email: type === 'EMAIL' ? normId(f.identifier) : f.email, mobile: type === 'MOBILE' ? f.identifier : f.mobile });
      accountEmail(d, x, school, 'WELCOME');
      log(d, x.name, 'Account created', `${x.login} · waiting for approval`);
      return x;
    });
    onPeek(u.email || f.identifier); setStep(6); notify('Account created — waiting for school approval');
  };

  const steps = ['Name', 'Sign-in ID', 'Verify', 'Password', 'Profile', 'Done'];
  return (
    <div className="card">
      <div className="row small" style={{ marginBottom: 12 }}>{steps.map((s, i) => <span key={s} className={'pill' + (step === i + 1 ? ' info' : step > i + 1 ? ' ok' : '')}>{i + 1}. {s}</span>)}</div>
      {step === 1 && <>
        <h2>Create your {school} account</h2>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}><Field label="First name" req><Input autoComplete="given-name" value={f.first} onChange={set('first')} /></Field><Field label="Last name"><Input autoComplete="family-name" value={f.last} onChange={set('last')} /></Field></div>
        <div className="row end" style={{ marginTop: 14 }}><button className="btn pri" onClick={next1}>Next</button></div>
      </>}
      {step === 2 && <>
        <h2>How will you sign in?</h2>
        <p className="small muted">Use your Gmail (or any email) or your mobile number. This becomes your sign-in ID.</p>
        <Field label="Gmail / email or mobile number" req><Input value={f.identifier} onChange={set('identifier')} placeholder="name@gmail.com or 98xxxxxxxx" /></Field>
        {type && <p className="small">{type === 'MOBILE' ? `Mobile +91 ${normMobile(f.identifier)} — we'll send a code by SMS` : isGmail(f.identifier) ? 'Gmail address — we’ll send a code to your inbox' : 'Email address — we’ll send a code to your inbox'}</p>}
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn pri" onClick={next2}>Send verification code</button></div>
      </>}
      {step === 3 && <>
        <h2>Verify it's you</h2>
        {sent?.channel === 'SMS' && sent.status === 'GATEWAY_PENDING'
          ? <div className="note warn small">OTP by SMS is ready but no SMS provider is connected yet. For testing, your code is <b>{sent.code}</b>.</div>
          : sent?.channel === 'SMS' ? <p className="small">We sent a 6-digit code by SMS to <b>{sent.to}</b>.</p>
          : <p className="small">Enter the 6-digit code we sent to <b>{sent?.to}</b> (see the test inbox).</p>}
        <div style={{ marginTop: 10 }}><Field label="Code"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} /></Field></div>
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(2)}>Change</button><button className="btn pri" disabled={code.length !== 6} onClick={next3}>Verify</button></div>
      </>}
      {step === 4 && <>
        <h2>Create a password</h2>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Password" req><Input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
          <Field label="Confirm" req><Input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
        </div>
        <p className="small">{f.password ? (probs.length ? 'Still needs: ' + probs.join(', ') : 'Strong password ✓') : 'Use 8 or more characters with upper and lower case, a number and a symbol.'}</p>
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(3)}>Back</button><button className="btn pri" onClick={next4}>Next</button></div>
      </>}
      {step === 5 && <>
        <h2>Your profile</h2>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="I am a"><Select value={f.requestedRole} onChange={set('requestedRole')} options={[['PARENT', 'Parent / guardian'], ['STAFF', 'Staff member']]} /></Field>
          {f.requestedRole === 'PARENT' ? <Field label="Child's admission number" req><Input value={f.admissionNo} onChange={set('admissionNo')} placeholder="ADM-2025-0231" /></Field>
            : <Field label="Designation"><Select value={f.designation} onChange={set('designation')} options={DESIGNATIONS} /></Field>}
          {type === 'MOBILE' ? <Field label="Gmail for account emails (recommended)"><Input value={f.email} onChange={set('email')} placeholder="name@gmail.com" /></Field>
            : <Field label="Mobile (for future SMS codes)"><Input value={f.mobile} onChange={set('mobile')} maxLength={10} /></Field>}
        </div>
        <label className="row small" style={{ marginTop: 12 }}><input type="checkbox" checked={f.agree} onChange={set('agree')} />I agree to the school's terms and privacy notice (DPDP Act 2023).</label>
        <p className="small muted">The school office approves new accounts and sets your access. Your account details will be emailed to your Gmail.</p>
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(4)}>Back</button><button className="btn pri" onClick={finish}>Create account</button></div>
      </>}
      {step === 6 && <>
        <h2>Account created</h2>
        <p>Thanks, {f.first}. The school office will check your details and approve your account — usually within a working day. We've emailed your account details{type === 'MOBILE' && !f.email ? ' (add a Gmail next time to receive them)' : ''}.</p>
        <p className="small muted">To test approval now: use Demo quick access → Admin → Operations → Users.</p>
        <button className="btn pri" onClick={onDone}>Back to sign in</button>
      </>}
      {err && <div className="note warn" style={{ marginTop: 12 }} role="alert">{err}</div>}
    </div>
  );
}

function Demo() {
  const { db, login } = useStore();
  const userFor = (code) => db.users.find((u) => u.role === code && u.status === 'ACTIVE' && !['Vice Principal', 'Head of Teaching Staff'].includes(u.designation));
  return (
    <div>
      <p className="muted small">For quick testing: sign in as a demo account for each role without a password.</p>
      <div className="rolegrid">
        {ROLES.map((r) => { const u = userFor(r.code); return (
          <button key={r.code} onClick={() => login({ role: r.code, userId: u?.id, name: u?.name || r.user })}>
            <div className="b">{r.name}</div><div className="small muted">{u?.name || r.user}</div><div className="small" style={{ marginTop: 6 }}>{WHAT[r.code]}</div>
          </button>); })}
        {(() => { const h = db.users.find((u) => u.designation === 'Head of Teaching Staff'); return h && <button onClick={() => login({ role: h.role, userId: h.id, name: h.name })}>
          <div className="b">Teacher + Head of Teaching Staff</div><div className="small muted">{h.name}</div><div className="small" style={{ marginTop: 6 }}>Can share teacher performance with teachers (view only)</div></button>; })()}
        {(() => { const vp = db.users.find((u) => u.designation === 'Vice Principal'); return vp && <button onClick={() => login({ role: vp.role, userId: vp.id, name: vp.name })}>
          <div className="b">Teacher + Vice Principal</div><div className="small muted">{vp.name}</div><div className="small" style={{ marginTop: 6 }}>Teacher role, but the designation opens Users, Roles, Admissions and analytics</div></button>; })()}
      </div>
    </div>
  );
}
