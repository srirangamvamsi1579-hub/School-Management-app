// Operations → Web & App Screens: for each role, choose which screens show on the website, in the app, or both.
// Draft → send for approval → a different person approves → published as a new version (history + restore).
import { useMemo, useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Tabs, Modal, Field, Input } from '../components/ui.jsx';
import { MENU, PLANS, PHONE_READY, CHANNELS, LOCKED_BOTH, RECOMMENDED, ACCESS, canSee, channelIn, mobileTabs, webScreens } from '../data/menu.js';
import { tenantOf } from '../lib/logic.js';
import { roleName, rolePerms } from '../lib/auth.js';
import { CAN_EDIT, CAN_APPROVE, LAYOUT_ROLES, diffLayouts, setChannel, resetDraft, discardDraft, submitDraft, withdraw, approve, sendBack, restoreVersion } from '../lib/channels.js';
import { Icon } from '../mobile/MobileApp.jsx';

const STATUS = { PUBLISHED: ['ok', 'Published'], DRAFT: ['warn', 'Draft — not live yet'], PENDING: ['info', 'Waiting for approval'] };
const when = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function ChannelScreens() {
  const { db, run, notify, session } = useStore();
  const t = tenantOf(db);
  const c = t.channels || { published: {}, version: 1, history: [], status: 'PUBLISHED' };
  const [role, setRole] = useState('PARENT');
  const [view, setView] = useState(c.draft ? 'draft' : 'live');
  const [ask, setAsk] = useState(null);           // { kind: 'submit' | 'approve' | 'back', note }
  const [tab, setTab] = useState('screens');
  const editor = CAN_EDIT.includes(session.role);
  const approver = CAN_APPROVE.includes(session.role);
  const layout = view === 'draft' && c.draft ? c.draft : c.published;
  const editable = editor && c.status !== 'PENDING';
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  const perms = { [role]: rolePerms(db, role) };
  const changes = c.draft ? diffLayouts(c.published, c.draft) : [];
  const me = session.name || roleName(db, session.role);
  const act = (fn, msg) => { try { const r = run(fn); if (msg) notify(typeof msg === 'function' ? msg(r) : msg); return true; } catch (e) { notify(e.message); return false; } };
  const choose = (code, ch) => { if (act((d) => setChannel(d, role, code, ch, me))) setView('draft'); };

  // Screens this role can open (plan, add-ons and role permissions), grouped by module
  const groups = useMemo(() => MENU.map((m) => ({ m, items: m.items.filter((i) => i[0][0] !== '#' && canSee(i[0], role, rank, t.overrides, perms)) })).filter((g) => g.items.length), [role, rank, t.overrides, db.perms]);
  const tabs = mobileTabs({ ...t, mobile: { enabled: true } }, role, perms, layout);
  const web = webScreens(t, role, perms, layout);
  const [st, stLabel] = STATUS[c.status] || STATUS.PUBLISHED;

  return (
    <Page title="Web & App Screens" sub="Choose, for each role, which screens show on the website, in the mobile app, or both. Who can open a screen is still set in Roles & Permissions; this only decides where it shows.">
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className={'pill ' + st}>{stLabel}</span>
        <span className="small">Live: version {c.version}{c.history?.[0] ? ` · approved by ${c.history[0].approvedBy} on ${when(c.history[0].at)}` : ''}</span>
        {!t.mobile?.enabled && <span className="pill warn">The mobile app is switched off for this school (Platform Console)</span>}
        <span className="sp" />
        {c.draft && <div className="seg" role="group" aria-label="Which layout to show">
          <button className={'btn sm' + (view === 'live' ? ' pri' : '')} aria-pressed={view === 'live'} onClick={() => setView('live')}>Live</button>
          <button className={'btn sm' + (view === 'draft' ? ' pri' : '')} aria-pressed={view === 'draft'} onClick={() => setView('draft')}>Draft</button></div>}
      </div>

      {/* Workflow bar */}
      <Card title="Change workflow" right={<span className="small muted">Edit: Admin or platform team · Approve: Principal or platform team · a different person must approve</span>}>
        <ol className="steps">
          <li className={c.status === 'DRAFT' ? 'on' : c.status === 'PENDING' ? 'done' : ''}>1. Edit a draft</li>
          <li className={c.status === 'PENDING' ? 'on' : ''}>2. Send for approval</li>
          <li className={c.status === 'PUBLISHED' && !c.draft ? 'done' : ''}>3. Approved and published</li>
        </ol>
        {c.rejectNote && c.status === 'DRAFT' && <div className="note warn" role="status">Sent back by {c.rejectedBy}: {c.rejectNote}</div>}
        {c.status === 'PENDING' && <p className="small">Sent by <b>{c.submittedBy}</b> on {when(c.submittedAt)}{c.submitNote ? ` — “${c.submitNote}”` : ''}. {changes.length} change(s).</p>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {editor && c.status !== 'PENDING' && <button className="btn" onClick={() => { if (act((d) => resetDraft(d, 'RECOMMENDED', me), 'Draft set to the recommended layout')) setView('draft'); }}>Start from recommended</button>}
          {editor && c.status === 'DRAFT' && <button className="btn" onClick={() => { act((d) => discardDraft(d, me), 'Draft discarded'); setView('live'); }}>Discard draft</button>}
          {editor && c.status === 'DRAFT' && <button className="btn pri" disabled={!changes.length} onClick={() => setAsk({ kind: 'submit', note: '' })}>Send for approval ({changes.length})</button>}
          {editor && c.status === 'PENDING' && <button className="btn" onClick={() => act((d) => withdraw(d, me), 'Taken back to draft')}>Take back</button>}
          {approver && c.status === 'PENDING' && <><button className="btn" onClick={() => setAsk({ kind: 'back', note: '' })}>Send back</button><button className="btn pri" onClick={() => setAsk({ kind: 'approve', note: '' })}>Approve and publish</button></>}
          {!editor && !approver && <span className="small muted">You can look; changes are made by an Admin.</span>}
          {editor && !c.draft && c.status === 'PUBLISHED' && <span className="small muted">Change any choice below to start a draft. Nothing changes for users until it is approved.</span>}
        </div>
        {changes.length > 0 && <details style={{ marginTop: 10 }} open={c.status === 'PENDING'}><summary className="small b">What the draft changes ({changes.length})</summary>
          <div className="tw"><table className="t"><thead><tr><th>Role</th><th>Screen</th><th>Live now</th><th>In the draft</th></tr></thead>
            <tbody>{changes.map((x) => <tr key={x.role + x.code}><td>{roleName(db, x.role)}</td><td>{x.label}</td><td>{CHANNELS[x.from]}</td><td className="b">{CHANNELS[x.to]}</td></tr>)}</tbody></table></div></details>}
      </Card>

      <Tabs tabs={[['screens', 'Screens by role'], ['matrix', 'All roles at a glance'], ['history', `History (${c.history?.length || 0})`]]} value={tab} onChange={setTab} />

      {tab === 'screens' && <>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0' }} role="group" aria-label="Role">
          {LAYOUT_ROLES.map((r) => <button key={r} className={'btn sm' + (role === r ? ' pri' : '')} aria-pressed={role === r} onClick={() => setRole(r)}>{roleName(db, r)}</button>)}
        </div>
        <div className="grid g-side">
          <Card title={`${roleName(db, role)} — where each screen shows (${view === 'draft' && c.draft ? 'draft' : 'live'})`}>
            <div className="tw"><table className="t"><thead><tr><th>Screen</th><th>Shows on</th><th>Recommended</th></tr></thead>
              <tbody>{groups.map(({ m, items }) => [
                <tr key={m.code}><td colSpan={3} className="small b muted" style={{ background: 'var(--bg)' }}>{m.label}</td></tr>,
                ...items.map(([code, label]) => { const ch = channelIn(layout, role, code); const ready = !!PHONE_READY[code]; const locked = LOCKED_BOTH.includes(code);
                  return <tr key={code}><td>{label}</td>
                    <td>{!ready ? <span className="small muted">Website only — not built for phones</span>
                      : locked ? <span className="small"><b>Website + app</b> · always (account deletion must be in the app)</span>
                      : <div className="seg" role="radiogroup" aria-label={`${label}: where it shows`}>{Object.entries(CHANNELS).map(([k, l]) =>
                        <button key={k} role="radio" aria-checked={ch === k} className={'btn sm' + (ch === k ? ' pri' : '')} disabled={!editable} onClick={() => choose(code, k)}>{l}</button>)}</div>}</td>
                    <td className="small muted">{ready ? CHANNELS[RECOMMENDED[role]?.[code] || 'WEB'] : '—'}</td></tr>; })])}</tbody></table></div>
          </Card>
          <div>
            <Card title="Preview">
              <p className="small muted">What a {roleName(db, role).toLowerCase()} sees{view === 'draft' && c.draft ? ' once the draft is published' : ' now'}.</p>
              <div className="b small">Website menu ({web.length} screens)</div>
              <ul className="small" style={{ margin: '6px 0 12px', paddingLeft: 18 }}>{MENU.filter((m) => m.items.some((i) => web.includes(i[0]))).map((m) => <li key={m.code}><b>{m.label}:</b> {m.items.filter((i) => web.includes(i[0])).map((i) => i[1]).join(', ')}</li>)}</ul>
              <div className="b small">Phone app ({tabs.length} tabs{tabs.length > 5 ? '; 4 shown, the rest under More' : ''})</div>
              <div className="phone-mini" aria-label="Phone tab bar preview">{(tabs.length > 5 ? [...tabs.slice(0, 4), ['MORE', 'More', 'more']] : tabs).map(([code, label, icon]) => <span key={code} className="m-tab"><Icon name={icon} size={18} /><span>{label}</span></span>)}</div>
              {tabs.length > 5 && <p className="small muted">Under More: {tabs.slice(4).map((x) => x[1]).join(', ')}</p>}
              <a className="btn sm" href="#/p/mobile" target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>Open the phone preview</a>
            </Card>
            <Card title="Good to know">
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                <li>Designations and screens given to one person follow the role's choice for that screen.</li>
                <li>“App only” hides a screen from the website menu for that role — useful for the Gate Desk on a tablet.</li>
                <li>Phones fit 5 tabs; more go under More. Keep the app to the few things people do every day.</li>
              </ul>
            </Card>
          </div>
        </div>
      </>}

      {tab === 'matrix' && <div className="tw" style={{ marginTop: 10 }}><table className="t"><thead><tr><th>Phone-ready screen</th>{LAYOUT_ROLES.map((r) => <th key={r}>{roleName(db, r)}</th>)}</tr></thead>
        <tbody>{Object.keys(PHONE_READY).map((code) => <tr key={code}><td className="b">{MENU.flatMap((m) => m.items).find((i) => i[0] === code)[1]}</td>
          {LAYOUT_ROLES.map((r) => { const has = canSee(code, r, rank, t.overrides, { [r]: rolePerms(db, r) }); const ch = channelIn(layout, r, code);
            return <td key={r} className="small">{has ? <span className={'pill ' + (ch === 'BOTH' ? 'ok' : ch === 'APP' ? 'info' : '')}>{CHANNELS[ch]}</span> : <span className="muted">no access</span>}</td>; })}</tr>)}</tbody></table>
        <p className="small muted">Screens not listed are not built for phones and always show on the website for the roles that can open them.</p></div>}

      {tab === 'history' && <div className="tw" style={{ marginTop: 10 }}><table className="t"><thead><tr><th>Version</th><th>Published</th><th>Sent by</th><th>Approved by</th><th>Changes</th><th>Note</th><th /></tr></thead>
        <tbody>{(c.history || []).map((h) => <tr key={h.version}><td className="b">v{h.version}{h.version === c.version ? ' (live)' : ''}</td><td className="small">{when(h.at)}</td><td>{h.submittedBy}</td><td>{h.approvedBy}</td>
          <td className="small">{h.changes.length ? h.changes.map((x) => `${roleName(db, x.role)}: ${x.label} → ${CHANNELS[x.to]}`).join('; ') : '—'}</td><td className="small">{h.note || '—'}</td>
          <td>{editor && h.version !== c.version && c.status !== 'PENDING' && <button className="btn sm" onClick={() => { if (act((d) => restoreVersion(d, h.version, me), `Version ${h.version} copied into a draft — send it for approval to go live`)) { setView('draft'); setTab('screens'); } }}>Restore as draft</button>}</td></tr>)}</tbody></table></div>}

      {ask && <Modal title={{ submit: 'Send for approval', approve: 'Approve and publish', back: 'Send back to the editor' }[ask.kind]} onClose={() => setAsk(null)}
        actions={<button className="btn pri" disabled={ask.kind === 'back' && !ask.note.trim()} onClick={() => {
          const ok = ask.kind === 'submit' ? act((d) => submitDraft(d, { by: me, byId: session.userId, note: ask.note }), 'Sent — the Principal has been asked to approve')
            : ask.kind === 'approve' ? act((d) => approve(d, { by: me, byId: session.userId, note: ask.note }), (v) => `Published as version ${v}`)
            : act((d) => sendBack(d, { by: me, byId: session.userId, note: ask.note }), 'Sent back to the editor');
          if (ok) { setAsk(null); if (ask.kind === 'approve') setView('live'); } }}>{{ submit: 'Send', approve: 'Publish', back: 'Send back' }[ask.kind]}</button>}>
        {ask.kind !== 'back' && <p className="small">{changes.length} change(s){ask.kind === 'approve' ? '. People see them at their next sign-in or when the app refreshes.' : '.'}</p>}
        <Field label={ask.kind === 'back' ? 'What should change (required)' : 'Note (optional)'}><Input value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} placeholder={ask.kind === 'submit' ? 'e.g. Gate Desk on the gate tablet only' : ''} /></Field>
      </Modal>}
    </Page>
  );
}
