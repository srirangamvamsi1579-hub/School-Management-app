import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Modal, Html, Tabs, Switch } from '../components/ui.jsx';
import { dmon } from '../lib/format.js';
import { log, resolveTemplate, renderFor, categoryName, tenantOf } from '../lib/logic.js';
import { CATEGORIES, FIELDS, SAMPLE, renderTemplate, sanitize } from '../data/templates.js';
import { MENU, ROLES, ACCESS, LABEL, PLANS, canSee } from '../data/menu.js';
import { PRESETS, TEMPLATES, contrast, accessible } from '../lib/theme.js';

export function Users() {
  const { db } = useStore();
  const users = [
    ...ROLES.filter((r) => !['PARENT', 'PLATFORM'].includes(r.code)).map((r, i) => ({ name: r.user, login: r.user.split(' ')[0].toLowerCase() + '@school.example.in', role: r.name, last: i ? '2 days ago' : 'Today', status: 'Active' })),
    ...db.staff.slice(1, 8).map((s) => ({ name: s.first + ' ' + s.last, login: s.email, role: 'Teacher', last: '—', status: 'Active' })),
    { name: 'Rohit Sharma', login: '+91 98123 44410', role: 'Parent', last: 'Yesterday', status: 'Active' }];
  return <Page title="Users" sub={`${users.length} staff and parent logins shown (parents get a login automatically from the guardian mobile).`}>
    <div className="tw"><table className="t"><thead><tr><th>Name</th><th>Login</th><th>Role</th><th>Last sign-in</th><th>MFA</th><th>Status</th></tr></thead>
      <tbody>{users.map((u, i) => <tr key={i}><td className="b">{u.name}</td><td>{u.login}</td><td>{u.role}</td><td>{u.last}</td><td>{u.role === 'Parent' ? 'OTP' : 'OTP + password'}</td><td><Status s={u.status} /></td></tr>)}</tbody></table></div>
  </Page>;
}

export function Roles() {
  const { db, mutate, notify } = useStore();
  const perms = db.perms || ACCESS;
  const roles = ROLES.filter((r) => r.code !== 'PLATFORM' && r.code !== 'ADMIN');
  const t = tenantOf(db);
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  const toggle = (role, code) => mutate((d) => { const p = structuredClone(d.perms || ACCESS); p[role] = p[role].includes(code) ? p[role].filter((x) => x !== code) : [...p[role], code]; d.perms = p; });
  return <Page title="Roles & permissions" sub="Tick what each role can open. A menu also needs to be in the school's plan — greyed rows are not in the plan." actions={<button className="btn" onClick={() => { mutate((d) => { d.perms = null; }); notify('Back to defaults'); }}>Reset to defaults</button>}>
    <div className="tw"><table className="t"><thead><tr><th>Menu</th>{roles.map((r) => <th key={r.code} style={{ textAlign: 'center' }}>{r.name}</th>)}</tr></thead>
      <tbody>{MENU.filter((m) => m.code !== 'PLATFORM').map((m) => [<tr key={m.code}><td colSpan={roles.length + 1} className="b" style={{ background: 'var(--bg)' }}>{m.label}</td></tr>,
        ...m.items.filter((i) => i[0][0] !== '#').map((i) => { const inPlan = canSee(i[0], 'ADMIN', rank, t.overrides, null) || ['SELF_CHILD', 'SELF_FEES'].includes(i[0]); return <tr key={i[0]} style={{ opacity: inPlan ? 1 : .45 }}><td style={{ paddingLeft: 22 }}>{i[1]}</td>
          {roles.map((r) => <td key={r.code} style={{ textAlign: 'center' }}><input type="checkbox" aria-label={r.name + ' ' + i[1]} checked={perms[r.code].includes(i[0])} onChange={() => toggle(r.code, i[0])} /></td>)}</tr>; })])}</tbody></table></div>
  </Page>;
}

export function Templates() {
  const { db, run, notify, session } = useStore();
  const [cat, setCat] = useState('FEE_INVOICE');
  const [edit, setEdit] = useState(null);
  const [preview, setPreview] = useState(null);
  const isAdmin = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  const list = db.templates.filter((t) => t.category === cat);
  const using = resolveTemplate(db, cat, session.role);
  const d = db.templateDefaults[cat] || {};
  const setDefault = (scope, id) => { run((x) => { x.templateDefaults[cat] = { ...(x.templateDefaults[cat] || {}), [scope]: id }; log(x, session.role, 'Template default set', `${categoryName(cat)} · ${scope} → ${id}`); }); notify('Default updated'); };
  const save = () => {
    run((x) => {
      const body = sanitize(edit.body);
      if (edit.id && x.templates.find((t) => t.id === edit.id && t.source !== 'STANDARD')) {
        const t = x.templates.find((y) => y.id === edit.id); t.history = [...(t.history || []), { version: t.version, body: t.body, at: new Date().toISOString() }];
        Object.assign(t, { name: edit.name, subject: edit.subject, body, version: t.version + 1 });
      } else x.templates.push({ id: 'T' + Date.now(), category: cat, name: edit.name, subject: edit.subject, body, source: edit.source || 'CUSTOM', status: 'ACTIVE', version: 1, originalFile: edit.originalFile });
      log(x, session.role, 'Template saved', edit.name);
    });
    setEdit(null); notify('Template saved');
  };
  const upload = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (/\.(html?|txt)$/i.test(f.name)) { const text = await f.text(); setEdit({ name: f.name.replace(/\.\w+$/, ''), body: text, source: 'UPLOADED', originalFile: f.name }); }
    else setEdit({ name: f.name.replace(/\.\w+$/, ''), body: list[0]?.body || '', source: 'UPLOADED', originalFile: f.name, note: `“${f.name}” is kept as the reference copy. Our team (or you) rebuilds it below using the placeholders — the standard layout is pre-filled to start from.` });
  };
  return (
    <Page title="Templates" sub="Every printed document, email and SMS uses a template. Use the standard one, edit a copy, or upload the school's existing format. Choose which one the school, a role or you use.">
      <div className="grid" style={{ gridTemplateColumns: '240px 1fr' }}>
        <Card title="Document types">
          {CATEGORIES.map((c) => <button key={c.code} className={'btn sm' + (cat === c.code ? ' pri' : '')} style={{ display: 'flex', width: '100%', marginBottom: 4, justifyContent: 'space-between' }} onClick={() => setCat(c.code)}>{c.name}<span className="small" style={{ opacity: .7 }}>{c.output}</span></button>)}
        </Card>
        <div>
          <Card title={categoryName(cat)} right={<span className="small">You see: <b>{using?.name}</b></span>}>
            <div className="tw"><table className="t"><thead><tr><th>Template</th><th>Source</th><th>Version</th><th>School default</th><th>My default</th><th /></tr></thead>
              <tbody>{list.map((t) => <tr key={t.id}><td className="b">{t.name}{t.originalFile && <div className="small muted">from {t.originalFile}</div>}</td><td><span className="pill">{t.source}</span></td><td>v{t.version}</td>
                <td>{isAdmin ? <input type="radio" name="sd" checked={(d.SCHOOL || list.find((x) => x.source === 'STANDARD')?.id) === t.id} onChange={() => setDefault('SCHOOL', t.id)} /> : (d.SCHOOL === t.id ? '✓' : '')}</td>
                <td><input type="radio" name="md" checked={d['ROLE:' + session.role] === t.id} onChange={() => setDefault('ROLE:' + session.role, t.id)} /></td>
                <td className="row"><button className="btn sm" onClick={() => setPreview(t)}>Preview</button>
                  <button className="btn sm" onClick={() => setEdit(t.source === 'STANDARD' ? { name: t.name.replace('Standard', 'Our'), subject: t.subject, body: t.body } : { ...t })}>{t.source === 'STANDARD' ? 'Copy & edit' : 'Edit'}</button></td></tr>)}</tbody></table></div>
            <div className="row" style={{ marginTop: 12 }}>
              <label className="btn">Upload existing template<input type="file" accept=".html,.htm,.txt,.pdf,.docx,.jpg,.jpeg,.png" onChange={upload} style={{ display: 'none' }} /></label>
              <button className="btn" onClick={() => setEdit({ name: 'New ' + categoryName(cat).toLowerCase(), subject: '', body: '' })}>Start blank</button>
              <span className="small muted">Which one is used: your choice → your role's → the school default → standard.</span>
            </div>
          </Card>
        </div>
      </div>
      {preview && <Modal title={preview.name} onClose={() => setPreview(null)}>{preview.subject && <p><b>Subject:</b> {renderTemplate(preview.subject, SAMPLE)}</p>}<Html html={renderFor({ ...db, templates: [preview], templateDefaults: {} }, cat, { ...SAMPLE }).body || renderTemplate(preview.body, { ...SAMPLE, accent: db.theme.color })} /></Modal>}
      {edit && <Modal title={edit.id ? 'Edit template' : 'New template'} onClose={() => setEdit(null)} actions={<button className="btn pri" disabled={!edit.name || !edit.body} onClick={save}>Save{edit.id && edit.version ? ` as v${edit.version + 1}` : ''}</button>}>
        {edit.note && <div className="note" style={{ marginBottom: 10 }}>{edit.note}</div>}
        <div className="grid g2">
          <div>
            <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            {['FEE_REQUEST_EMAIL', 'PAYMENT_CONFIRMATION_EMAIL'].includes(cat) && <Field label="Email subject"><Input value={edit.subject || ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>}
            <Field label="Body (HTML with placeholders)"><textarea className="i" style={{ minHeight: 280 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <p className="small muted">Click to insert:</p>
            <div className="row">{FIELDS[cat].map((f) => { const k = f.replace(/\[.*/, ''); const ins = f.includes('[') ? `{{#items}}${f.match(/\[(.*)\]/)[1].split(', ').map((x) => `{{${x}}}`).join(' ')}{{/items}}` : `{{${k}}}`; return <button key={f} className="btn sm" onClick={() => setEdit({ ...edit, body: edit.body + ins })}>{k}</button>; })}</div>
          </div>
          <div><p className="small b">Live preview with sample data</p>{edit.subject && <p className="small">Subject: {renderTemplate(edit.subject, SAMPLE)}</p>}<Html html={renderTemplate(sanitize(edit.body), { ...SAMPLE, accent: db.theme.color })} /></div>
        </div>
      </Modal>}
    </Page>
  );
}

export function Appearance() {
  const { db, run, notify, session } = useStore();
  const [th, setTh] = useState(db.theme);
  const [own, setOwn] = useState(th.color);
  const t = tenantOf(db);
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  const fixed = accessible(th.color);
  const ratio = contrast(th.color, '#FFFFFF');
  return <Page title="Appearance & branding" sub="Layout template, brand colour and density for everyone in the school. Colours are checked for readability automatically."
    actions={<><button className="btn" onClick={() => setTh(db.theme)}>Discard</button><button className="btn pri" onClick={() => { run((d) => { d.theme = th; log(d, session.role, 'Theme published', `${th.template} ${th.color}`); }); notify('Published for all users'); }}>Publish</button></>}>
    <div className="grid g2">
      <Card title="Layout template">{TEMPLATES.map(([k, l]) => <label key={k} className="row" style={{ marginBottom: 6 }}><input type="radio" checked={th.template === k} onChange={() => setTh({ ...th, template: k })} />{l}</label>)}</Card>
      <Card title="Brand colour">
        <div className="row">{PRESETS.map(([c, n]) => <button key={c} title={n} aria-label={n} onClick={() => { setTh({ ...th, color: c }); setOwn(c); }} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: th.color === c ? '3px solid var(--ink)' : '1px solid var(--line)', cursor: 'pointer' }} />)}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <Field label={rank >= 2 ? 'Your own colour (hex)' : 'Your own colour — Growth plan and above'}><Input value={own} disabled={rank < 2} onChange={(e) => { setOwn(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) setTh({ ...th, color: e.target.value.toUpperCase() }); }} /></Field>
        </div>
        <p className="small" style={{ marginTop: 8 }}>Contrast with white text: <b>{ratio.toFixed(1)} : 1</b> {ratio < 4.5 ? <>— too light for buttons, so the app uses <span className="pill" style={{ background: fixed, color: '#fff' }}>{fixed}</span> instead</> : '✓ readable'}</p>
      </Card>
      <Card title="Other">
        <div className="row"><Switch on={th.mode === 'DARK'} label="Dark mode" onClick={() => setTh({ ...th, mode: th.mode === 'DARK' ? 'LIGHT' : 'DARK' })} />Dark mode</div>
        <div className="row" style={{ marginTop: 8 }}><Switch on={th.density === 'COMPACT'} label="Compact" onClick={() => setTh({ ...th, density: th.density === 'COMPACT' ? 'COMFORTABLE' : 'COMPACT' })} />Compact tables</div>
        <Field label="Corner roundness"><input type="range" min="0" max="16" value={th.radius} onChange={(e) => setTh({ ...th, radius: Number(e.target.value) })} /></Field>
        <Field label="Font"><Select value={th.font} onChange={(e) => setTh({ ...th, font: e.target.value })} options={['Inter', 'Georgia', 'Verdana', 'Trebuchet MS']} /></Field>
      </Card>
      <Card title="Preview"><div style={{ border: '1px solid var(--line)', borderRadius: th.radius, overflow: 'hidden', fontFamily: th.font }}>
        <div style={{ background: th.template === 'BRIGHT' ? '#fff' : th.template === 'BRANDED' ? fixed : '#111827', color: th.template === 'BRIGHT' ? '#374151' : '#F3F4F6', padding: 10 }}>{t.name}</div>
        <div style={{ padding: 14, background: th.mode === 'DARK' ? '#171B22' : '#fff', color: th.mode === 'DARK' ? '#EEF0F3' : '#14171C' }}>Fee collected today<div style={{ fontSize: 22, fontWeight: 700 }}>₹4,02,530</div>
          <button style={{ background: fixed, color: '#fff', border: 0, padding: '8px 14px', borderRadius: th.radius, marginTop: 8 }}>Collect fee</button></div></div></Card>
    </div>
  </Page>;
}

export function WebsiteLinks() {
  const { db, run, notify, session } = useStore();
  const [f, setF] = useState({ label: '', url: 'https://', under: 'TOP', roles: ['PARENT'] });
  const ok = /^https:\/\/[^\s]+\.[^\s]+/.test(f.url) && f.label;
  return <Page title="Website & links" sub="Connect the school's existing website, or use a simple hosted page. Add links to website pages inside the app's menus.">
    <div className="grid g2">
      <Card title="Website">
        <div className="row"><label className="row"><input type="radio" checked={db.website.mode === 'EXISTING'} onChange={() => run((d) => { d.website.mode = 'EXISTING'; })} />Existing website</label>
          <label className="row"><input type="radio" checked={db.website.mode === 'NEW'} onChange={() => run((d) => { d.website.mode = 'NEW'; })} />New page hosted by us</label></div>
        {db.website.mode === 'EXISTING' ? <p>{db.website.url} <Status s="Approved" /><br /><span className="small muted">Verified by a DNS TXT record. Add a “Parent login” button on the website pointing to https://{tenantOf(db).subdomain}.yourapp.com</span></p>
          : <p>https://{tenantOf(db).subdomain}.yourapp.com/site — home, admissions enquiry, fee structure and contact pages, using the school's branding.</p>}
      </Card>
      <Card title="Add a menu link">
        <div className="grid" style={{ gap: 8 }}>
          <Field label="Label"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field label="Web address (https only)"><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
          <Field label="Show under"><Select value={f.under} onChange={(e) => setF({ ...f, under: e.target.value })} options={[['TOP', 'Top of the menu'], ...MENU.filter((m) => m.code !== 'PLATFORM').map((m) => [m.code, m.label])]} /></Field>
          <div className="row small">{ROLES.filter((r) => r.code !== 'PLATFORM').map((r) => <label key={r.code} className="row"><input type="checkbox" checked={f.roles.includes(r.code)} onChange={() => setF({ ...f, roles: f.roles.includes(r.code) ? f.roles.filter((x) => x !== r.code) : [...f.roles, r.code] })} />{r.name}</label>)}</div>
          <button className="btn pri" disabled={!ok} onClick={() => { run((d) => { d.links.push({ ...f, id: 'L' + Date.now(), open: 'NEW_TAB' }); log(d, session.role, 'Menu link added', f.label); }); setF({ ...f, label: '', url: 'https://' }); notify('Link added to the menu'); }}>Add link</button>
        </div>
      </Card>
    </div>
    <Card title="Menu links"><table className="t"><thead><tr><th>Label</th><th>Address</th><th>Under</th><th>Who sees it</th><th /></tr></thead>
      <tbody>{db.links.map((l) => <tr key={l.id}><td className="b">{l.label}</td><td><a href={l.url} target="_blank" rel="noreferrer">{l.url}</a></td><td>{l.under === 'TOP' ? 'Top' : MENU.find((m) => m.code === l.under)?.label}</td><td className="small">{l.roles.join(', ')}</td>
        <td><button className="btn sm danger" onClick={() => run((d) => { d.links = d.links.filter((x) => x.id !== l.id); })}>Remove</button></td></tr>)}</tbody></table></Card>
  </Page>;
}

export function Outbox() {
  const { db } = useStore();
  const [open, setOpen] = useState(null);
  return <Page title="Email & SMS outbox" sub="Everything the app has sent. In the test build nothing actually leaves your browser; in production emails go through Amazon SES and SMS through an Indian SMS gateway (DLT-registered templates).">
    <div className="tw"><table className="t"><thead><tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th><th /></tr></thead>
      <tbody>{db.outbox.length === 0 ? <tr><td colSpan={6} className="muted">Nothing sent yet.</td></tr> : db.outbox.slice(0, 300).map((m) => <tr key={m.id}><td className="small">{dmon(m.at)}</td><td>{m.kind}</td><td>{m.to || '—'}</td><td>{m.subject}</td><td><Status s={m.status} /></td><td><button className="btn sm" onClick={() => setOpen(m)}>View</button></td></tr>)}</tbody></table></div>
    {open && <Modal title={open.subject} onClose={() => setOpen(null)}><p className="small">To: {open.to}</p>{open.subject === 'SMS' ? <p>{open.body}</p> : <Html html={open.body} />}</Modal>}
  </Page>;
}

export function Platform() {
  const { db, mutate, notify } = useStore();
  const [sel, setSel] = useState(db.tenantId);
  const t = db.tenants.find((x) => x.id === sel);
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  const isOn = (code, min) => (t.overrides[code] !== undefined ? t.overrides[code] : rank >= min);
  const toggle = (code, min) => mutate((d) => { const x = d.tenants.find((y) => y.id === sel); const now = x.overrides[code] !== undefined ? x.overrides[code] : rank >= min; x.overrides = { ...x.overrides, [code]: !now }; });
  return <Page title="Schools & plans" sub="Your company's console. Plan sets the default switches; turn any module or sub-menu on (add-on) or off per school.">
    <div className="grid" style={{ gridTemplateColumns: '300px 1fr' }}>
      <Card title="Schools">{db.tenants.map((x) => <button key={x.id} className={'btn' + (sel === x.id ? ' pri' : '')} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => setSel(x.id)}>{x.name}<div className="small" style={{ opacity: .8 }}>{PLANS.find((p) => p.code === x.plan).name} · {x.subdomain}.yourapp.com</div></button>)}</Card>
      <div>
        <Card title={t.name} right={<Select value={t.plan} onChange={(e) => { mutate((d) => { d.tenants.find((y) => y.id === sel).plan = e.target.value; }); notify('Plan changed — menus update straight away'); }} options={PLANS.map((p) => [p.code, `${p.name} (${p.range})`])} />}>
          <p className="small muted">Renews {t.renews}. Changes are written to the config audit log. Sign in to this school as any role to see the result.</p>
          {MENU.filter((m) => !['PLATFORM', 'SELF'].includes(m.code)).map((m) => <div key={m.code} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
            <div className="row"><Switch on={isOn(m.code, m.min)} label={m.label} onClick={() => toggle(m.code, m.min)} /><b>{m.label}</b>{t.overrides[m.code] !== undefined && <span className="pill info">{t.overrides[m.code] ? 'Add-on' : 'Switched off'}</span>}</div>
            {isOn(m.code, m.min) && <div className="row" style={{ paddingLeft: 44, marginTop: 6 }}>{m.items.filter((i) => i[0][0] !== '#').map((i) => <label key={i[0]} className="row small" style={{ marginRight: 10 }}>
              <input type="checkbox" checked={isOn(i[0], i[2])} onChange={() => toggle(i[0], i[2])} />{i[1]}{t.overrides[i[0]] && rank < i[2] ? ' (add-on)' : ''}{!isOn(i[0], i[2]) && rank < i[2] ? <span className="muted"> · {PLANS[i[2] - 1].name}+</span> : ''}</label>)}</div>}
          </div>)}
          <div className="row end"><button className="btn" onClick={() => mutate((d) => { d.tenants.find((y) => y.id === sel).overrides = {}; })}>Back to plan defaults</button></div>
        </Card>
      </div>
    </div>
  </Page>;
}

export function MyPrefs() {
  const { db, session } = useStore();
  return <Page title="My preferences"><Card><p>Language: English · Notifications: email and app · Templates you use:</p>
    <table className="t"><tbody>{CATEGORIES.map((c) => <tr key={c.code}><td>{c.name}</td><td>{resolveTemplate(db, c.code, session.role)?.name}</td></tr>)}</tbody></table>
    <p className="small muted">Change your own template choice in Operations → Templates (“My default”).</p></Card></Page>;
}

export { LABEL };
