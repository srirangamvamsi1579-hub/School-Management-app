import { WEBSITE_LINKS, linkFor, buttonSnippet, iframeSnippet } from '../lib/links.js';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Modal, Html, Tabs, Switch } from '../components/ui.jsx';
import { dmon } from '../lib/format.js';
import { log, resolveTemplate, renderFor, categoryName, tenantOf } from '../lib/logic.js';
import { CATEGORIES, FIELDS, SAMPLE, renderTemplate, sanitize } from '../data/templates.js';
import { isProvider, PROVIDER_MODULES, MENU, ROLES, ACCESS, LABEL, PLANS, canSee, FUNCTIONS, funcOn, mobileTabs, ALWAYS_ON, planDefault } from '../data/menu.js';
import { nameProblem } from '../lib/validate.js';
import { PRESETS, TEMPLATES, contrast, accessible } from '../lib/theme.js';
import { allRoles, roleName, rolePerms, accessLevel, accessSource, screensFor, departments, syncDeptPerms, defaultScreens, baseRoleOf, canManageUsers, accountEmail, createAccount, idType, isGmail, findUser } from '../lib/auth.js';
import { designationsFor, fitDesignation, designationProblem, departmentOf, STANDARD_PROFILES } from '../data/designations.js';
import { AccountRequests, deleteAccount } from './Account.jsx';
import { checkStudent, childLines, childrenOf, studentName, gradeOf, gradeOptions, touch, ARCHIVE_REASONS, designationLabel, canResetPasswords, RESET_PW, archiveMatches, fromArchive, ADD_REASONS, canAddUsers, sourceLabel } from '../lib/users.js';

const PAGE = 25;
// Page controls under a long list: 25 rows at a time
function Pager({ page, total, onPage, label }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE) return <p className="small muted" style={{ marginTop: 8 }}>{total} {label}</p>;
  const nums = [...Array(pages).keys()].filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 2);
  return <nav className="row" aria-label={'Pages of ' + label} style={{ marginTop: 10, justifyContent: 'space-between' }}>
    <span className="small muted">Showing {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total} {label}</span>
    <div className="row"><button className="btn sm" disabled={page === 0} onClick={() => onPage(page - 1)}>‹ Previous</button>
      {nums.map((i, k) => <span key={i} className="row">{k > 0 && i - nums[k - 1] > 1 && <span className="muted">…</span>}<button className={'btn sm' + (i === page ? ' pri' : '')} aria-current={i === page ? 'page' : undefined} aria-label={'Page ' + (i + 1)} onClick={() => onPage(i)}>{i + 1}</button></span>)}
      <button className="btn sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next ›</button></div>
  </nav>;
}

export function Users() {
  const { db, run, notify, session, refresh } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const school = tenantOf(db).name;
  const by = session.name || session.role;
  const [tab, setTab] = useState('users');
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [rf, setRf] = useState('');
  const [df, setDf] = useState('');
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [invite, setInvite] = useState(null);
  const [stamp, setStamp] = useState(() => new Date());
  const allowed = canManageUsers(db, me, session.role);
  const canReset = canResetPasswords(me, session.role);
  // The Admin also manages the Sales & marketing team's accounts (release 13.2); the Platform team stays with the platform
  const roles = allRoles(db).filter((r) => !isProvider(r.code) || isProvider(session.role) || (session.role === 'ADMIN' && me?.companyAdmin && r.code === 'SALES'));
  const roleOf = (u) => u.role || u.requestedRole;
  const filter = (fn) => (e) => { fn(e.target.value); setPage(0); };
  const depts = [...new Set(db.users.filter((u) => u.status !== 'DELETED').map((u) => departmentOf(db, roleOf(u))).filter(Boolean))].sort();
  // People whose details no longer fit after a change in Roles & Permissions or a student leaving
  const issue = (u) => {
    const r = roleOf(u);
    if (r && !allRoles(db).some((x) => x.code === r)) return `The ${roleName(db, r)} profile was deleted — pick another role`;
    if (r && r !== 'PARENT' && u.designation && designationProblem(db, r, u.designation)) return `${u.designation} is no longer offered for ${roleName(db, r)}`;
    if (r === 'PARENT' && childLines(db, u).some((k) => !k.ok)) return 'A linked admission number is not on the student record';
    return '';
  };
  const live = db.users.filter((u) => u.status !== 'DELETED');
  const list = live.filter((u) => (!st || u.status === st) && (!rf || roleOf(u) === rf) && (!df || departmentOf(db, roleOf(u)) === df)
    && (!q || (u.name + u.login + (u.email || '') + (u.designation || '') + childLines(db, u).map((k) => k.adm + k.name).join(' ')).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pg = Math.min(page, Math.max(0, Math.ceil(list.length / PAGE) - 1));
  const shown = list.slice(pg * PAGE, pg * PAGE + PAGE);
  const attention = live.filter(issue).length;
  const doRefresh = () => { const changed = refresh(); setStamp(new Date()); notify(changed ? 'Users updated with the latest changes' : `Users are up to date${attention ? ` · ${attention} need attention` : ''}`); };
  const problem = () => {
    const kids = (edit.childrenText || '').split(/[\s,]+/).filter(Boolean);
    const bad = kids.find((k) => !db.students.some((x) => x.admNo === k.toUpperCase()));
    const clash = [edit.email, edit.mobile].filter(Boolean).map((v) => findUser(db, v)).find((o) => o && o.id !== edit.id);
    return nameProblem(edit.name, 'Name') ? nameProblem(edit.name, 'Name') : edit.email && !idType(edit.email) ? 'Email looks wrong' : edit.mobile && idType(edit.mobile) !== 'MOBILE' ? 'Mobile must be 10 digits'
      : clash ? 'Another account already uses that email or mobile' : edit.role === 'PARENT' && !kids.length ? 'A parent needs at least one admission number' : edit.role === 'PARENT' && bad ? `No student with admission no. ${bad}`
      : edit.role !== 'PARENT' && designationProblem(db, edit.role, edit.designation) ? designationProblem(db, edit.role, edit.designation) : edit.role === 'ADMIN' && session.role !== 'ADMIN' ? 'Only an Admin can give the Admin role' : edit.id === me?.id && edit.role !== me.role ? "You can't change your own role" : '';
  };
  const save = () => {
    if (edit.status === 'DELETED') { setConfirmDel(true); return; }
    const err = problem(); if (err) { notify(err); return; }
    run((d) => {
      const u = d.users.find((x) => x.id === edit.id);
      const wasPending = u.status === 'PENDING';
      const kids = (edit.childrenText || '').split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
      const changes = [u.role !== edit.role && 'role', (u.designation || '') !== (edit.designation || '') && 'designation', u.status !== edit.status && 'status', u.name !== edit.name && 'name'].filter(Boolean);
      Object.assign(u, { name: edit.name, email: (edit.email || '').toLowerCase(), mobile: edit.mobile || '', role: edit.role, designation: edit.role === 'PARENT' ? 'Parent' : edit.designation || null, status: edit.status, extra: edit.extra, perms: edit.perms, companyAdmin: edit.role === 'ADMIN' && !!edit.companyAdmin, children: edit.role === 'PARENT' ? kids : [], linkedStudent: edit.role === 'PARENT' ? kids[0] || null : null });
      if (u.loginType === 'EMAIL' && u.email) u.login = u.email;
      if (u.loginType === 'MOBILE' && u.mobile) u.login = u.mobile;
      if (u.status === 'ACTIVE') u.failed = 0;
      touch(u, by);
      if (wasPending && u.status === 'ACTIVE') accountEmail(d, u, school, 'APPROVED');
      log(d, by, 'User updated', `${u.login}: ${changes.join(', ') || 'details'}`);
    });
    notify('Saved — takes effect at their next sign-in'); setEdit(null);
  };
  const doDelete = () => {
    run((d) => { deleteAccount(d, edit.id, by, { reason: edit.reason }); log(d, by, 'Account deleted and archived', `${edit.login} · ${edit.reason}`); });
    notify(`${edit.name} deleted — kept under Archived`); setConfirmDel(false); setEdit(null);
  };
  const sendInvite = () => {
    if (!canAddUsers(session.role)) { notify('Only the Admin can add a user'); return; }
    const why = invite.reason === 'Other' ? (invite.reasonText || '').trim() : invite.reason;
    if (!why) { notify('Say why this person is being added instead of registering'); return; }
    const np = nameProblem(invite.name, 'Full name'); if (np) { notify(np); return; }
    if (!idType(invite.identifier)) { notify('Enter a Gmail / email or 10-digit mobile'); return; }
    if (findUser(db, invite.identifier)) { notify('That sign-in ID already has an account'); return; }
    const dp = invite.role !== 'PARENT' && designationProblem(db, invite.role, invite.designation); if (dp) { notify(dp); return; }
    let kid = null;
    if (invite.role === 'PARENT') { const c = checkStudent(db, invite); if (c.error) { notify(c.error); return; } kid = c.student.admNo; }
    run((d) => {
      const tmp = Math.random().toString(36).slice(2) + 'A!9';
      const u = createAccount(d, { source: 'ADMIN', addReason: why, name: invite.name, identifier: invite.identifier, password: tmp, requestedRole: invite.role, designation: invite.role === 'PARENT' ? 'Parent' : invite.designation, email: invite.email, admissionNo: kid });
      Object.assign(u, { role: invite.role, status: 'ACTIVE', children: kid ? [kid] : u.children, ...(invite.fromArchive ? { copiedFrom: invite.fromArchive } : {}) });
      touch(u, by);
      accountEmail(d, u, school, 'RESET');
      log(d, by, invite.fromArchive ? 'User added again from the archive' : 'User added by the Admin', `${u.login} as ${roleName(d, u.role)} · ${why}`);
    });
    notify('Account created — a set-password link was emailed'); setInvite(null);
  };
  if (!allowed) return <Page title="Users"><Card><p>You don't have access to manage users. An Admin can give access by role or by designation in Roles & Permissions.</p></Card></Page>;
  const arch = db.userArchive || [];
  const statusOpts = (u) => [['ACTIVE', 'Active'], ['LOCKED', 'Locked'], ...(u.id !== me?.id ? [['DELETED', 'Deleted (moves to Archived)']] : [])];
  return <Page title="Users" sub={`${live.length} accounts · ${arch.length} archived. Parents and staff open their own accounts by registering on the website or in the app; their details are checked against the student and staff records, so nobody waits for approval. Changes apply at the person's next sign-in and are written to the audit log.`}
    actions={<><button className="btn" onClick={doRefresh} aria-label="Refresh users">↻ Refresh</button>{canAddUsers(session.role) && <button className="btn pri" title="Only for exceptions: people normally register on the website or in the app" onClick={() => setInvite({ name: '', identifier: '', email: '', role: 'TEACHER', designation: 'TGT', admissionNo: '', studentName: '', grade: '', reason: '' })}>Add user</button>}</>}>
    <Tabs tabs={[['users', 'Users'], ['archive', `Archived (${arch.length})`]]} value={tab} onChange={setTab} />
    {tab === 'archive' ? <UserArchive /> : <>
    <AccountRequests />
    {attention > 0 && <div className="note warn" style={{ marginBottom: 12 }}>{attention} account(s) need attention after a change in Roles & Permissions or the student record — marked ⚠ below.</div>}
    <div className="row" style={{ marginBottom: 12 }}>
      <Input placeholder="Search name, email, mobile, designation, student" aria-label="Search users" value={q} onChange={filter(setQ)} style={{ minWidth: 280 }} />
      <Select aria-label="Role filter" value={rf} onChange={filter(setRf)} options={[['', 'All roles'], ...roles.map((r) => [r.code, r.name])]} />
      <Select aria-label="Department filter" value={df} onChange={filter(setDf)} options={[['', 'All departments'], ...depts.map((x) => [x, x])]} />
      <Select aria-label="Status filter" value={st} onChange={filter(setSt)} options={[['', 'All statuses'], ['ACTIVE', 'Active'], ['LOCKED', 'Locked']]} />
      <span className="small muted">updated {stamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
    <div className="tw"><table className="t" aria-label="Users"><thead><tr><th>Name</th><th>Sign-in ID</th><th>Role</th><th>Department</th><th>Designation</th><th>Student (parents)</th><th>Created</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
      <tbody>{shown.map((u) => { const warn = issue(u); return <tr key={u.id}><td className="b">{u.name}{warn && <div className="small" style={{ color: 'var(--bad)' }}>⚠ {warn}</div>}</td>
        <td>{u.login}<div className="small muted">{u.loginType === 'MOBILE' ? 'Mobile' : isGmail(u.login) ? 'Gmail' : 'Email'}</div></td>
        <td>{u.role ? roleName(db, u.role) : <span className="muted">asked: {roleName(db, u.requestedRole)}</span>}</td>
        <td>{departmentOf(db, roleOf(u)) || '—'}</td><td>{designationLabel(u)}</td>
        <td className="small">{roleOf(u) === 'PARENT' ? childLines(db, u).map((k) => <div key={k.adm}>{k.ok ? <><b>{k.name}</b> · {k.grade}</> : <span style={{ color: 'var(--bad)' }}>Not found</span>}<div className="muted">{k.adm}</div></div>) : '—'}</td>
        <td className="small">{u.createdAt ? dmon(u.createdAt) : '—'}</td>
        <td className="small">{u.lastLogin ? dmon(u.lastLogin) : '—'}</td>
        <td><Status s={u.status} /></td>
        <td><div className="row"><button className="btn sm" aria-label={'Edit ' + u.name} onClick={() => setEdit({ ...u, role: roleOf(u), designation: fitDesignation(db, roleOf(u), u.designation), extra: [...(u.extra || [])], perms: [...(u.perms || [])], childrenText: childrenOf(u).join(', '), reason: ARCHIVE_REASONS[0] })}>Edit</button>
          {canReset && u.email && <button className="btn sm" onClick={() => { run((d) => { accountEmail(d, d.users.find((x) => x.id === u.id), school, 'RESET'); log(d, by, 'Password reset sent', u.login); }); notify('Set-password link emailed'); }}>Reset password</button>}</div></td></tr>; })}</tbody></table></div>
    <Pager page={pg} total={list.length} onPage={setPage} label="users" />
    </>}
    {edit && <Modal title={'Edit user — ' + edit.name} onClose={() => setEdit(null)} actions={<button className={'btn ' + (edit.status === 'DELETED' ? 'danger' : 'pri')} onClick={save}>{edit.status === 'DELETED' ? 'Delete and archive' : 'Save'}</button>}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label={'Role (decides the menus)' + (departmentOf(db, edit.role) ? ' · ' + departmentOf(db, edit.role) : '')}><Select value={edit.role || ''} disabled={edit.status === 'DELETED'} onChange={(e) => setEdit({ ...edit, role: e.target.value, designation: fitDesignation(db, e.target.value, edit.designation) })} options={[['', 'Pick a role'], ...roles.map((r) => [r.code, r.name + (r.builtIn ? '' : ' (custom)')])]} /></Field>
        {edit.role === 'PARENT' ? <Field label="Designation"><Input value="N/A" disabled aria-label="Designation: N/A" /></Field>
          : <Field label={`Designation (${edit.role ? 'for this role' : 'pick a role first'})`}><Select value={edit.designation || ''} disabled={!edit.role || edit.status === 'DELETED'} onChange={(e) => setEdit({ ...edit, designation: e.target.value })} options={[['', 'Pick a designation'], ...designationsFor(db, edit.role)]} /></Field>}
        <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={statusOpts(edit)} /></Field>
        {edit.status === 'DELETED' ? <Field label="Reason for deleting"><Select value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} options={ARCHIVE_REASONS.map((x) => [x, x])} /></Field>
          : <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>}
        {edit.status !== 'DELETED' && <>
          <Field label="Email (Gmail)"><Input value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label="Mobile"><Input value={edit.mobile || ''} maxLength={10} onChange={(e) => setEdit({ ...edit, mobile: e.target.value })} /></Field>
          {edit.role === 'PARENT' && <Field label="Children (admission nos., comma-separated)"><Input value={edit.childrenText} onChange={(e) => setEdit({ ...edit, childrenText: e.target.value.toUpperCase() })} /></Field>}</>}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>How the account was created: {sourceLabel(edit)}{edit.createdAt ? ' on ' + dmon(edit.createdAt) : ''}.</p>
      {edit.status === 'DELETED' ? <p className="note small" style={{ marginTop: 12 }}>The sign-in is removed and a copy of the account is kept under <b>Archived</b> (view only). Records the school must keep (fees, marks, receipts) stay.</p> : <>
      {edit.role === 'PARENT' && edit.childrenText && <p className="small">{edit.childrenText.split(/[\s,]+/).filter(Boolean).map((k) => { const x = db.students.find((y) => y.admNo === k); return x ? `✓ ${k} ${studentName(x)} · ${gradeOf(db, x)?.name}` : `⚠ ${k} not found`; }).join(' · ')}</p>}
      <h3 style={{ marginTop: 14 }}>Extra screens for this person only</h3>
      <p className="small muted">On top of the role{edit.designation && db.designationAccess[edit.designation] ? ` and the ${edit.designation} designation (${db.designationAccess[edit.designation].map((c) => LABEL[c]).join(', ')})` : ''}.</p>
      <div className="row">{['OPS_USERS', 'OPS_ROLES', 'STU_ADMISSIONS', 'ANL_RANK', 'ANL_TEACHER', 'ANL_TRANSPORT', 'FEE_DUES'].map((c) => <label key={c} className="row small" style={{ marginRight: 10 }}>
        <input type="checkbox" checked={edit.extra.includes(c)} onChange={() => setEdit({ ...edit, extra: edit.extra.includes(c) ? edit.extra.filter((x) => x !== c) : [...edit.extra, c] })} />{LABEL[c]}</label>)}</div>
      {session.role === 'ADMIN' && me?.companyAdmin && edit.role === 'ADMIN' && <>
        <h3 style={{ marginTop: 14 }}>Our company</h3>
        <label className="row small"><input type="checkbox" checked={!!edit.companyAdmin} onChange={(e) => setEdit({ ...edit, companyAdmin: e.target.checked })} />Our company's Admin: sees Service Provider (prices, proposals, demos, client delivery). Never tick this for a school's Admin.</label></>}
      {session.role === 'ADMIN' && edit.role !== 'ADMIN' && edit.role !== 'PARENT' && <>
        <h3 style={{ marginTop: 14 }}>Permissions</h3>
        <label className="row small"><input type="checkbox" checked={edit.perms.includes(RESET_PW)} onChange={() => setEdit({ ...edit, perms: edit.perms.includes(RESET_PW) ? edit.perms.filter((x) => x !== RESET_PW) : [...edit.perms, RESET_PW] })} />Can reset passwords in Users (the Admin role always can)</label></>}
      </>}
    </Modal>}
    {confirmDel && edit && <Modal title={`Delete ${edit.name}?`} onClose={() => setConfirmDel(false)} actions={<><button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button><button className="btn danger" onClick={doDelete}>Delete</button></>}>
      <p>{edit.name} will no longer be able to sign in. The account moves to <b>Archived</b> with the reason “{edit.reason}”.</p></Modal>}
    {invite && <Modal title="Add user" onClose={() => setInvite(null)} actions={<button className="btn pri" disabled={!!nameProblem(invite.name, 'Full name')} onClick={sendInvite}>Create and email link</button>}>
      <p className="note small" style={{ marginBottom: 12 }}>Parents and staff normally create their own account by registering on the school website or in the app. Add someone here only as an exception; the reason is recorded.</p>
      {(db.userArchive || []).length > 0 && <div className="card" style={{ marginBottom: 12 }}>
        <h3>Coming back? Copy details from the archive</h3>
        <Input placeholder="Search the archive by name, email, mobile or student" aria-label="Search the archive to copy" value={invite.archQ || ''} onChange={(e) => setInvite({ ...invite, archQ: e.target.value })} />
        {archiveMatches(db, invite.archQ).map((a) => <div key={a.id} className="row small" style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <span><b>{a.name}</b> · {a.roleName}{a.designation && a.role !== 'PARENT' ? ' · ' + a.designation : ''} · deleted {dmon(a.deletedAt)}</span>
          <button className="btn sm" aria-label={'Copy details of ' + a.name} onClick={() => { const r = fromArchive(db, a, { roles: roles.filter((x) => !isProvider(x.code)), fit: (ro, de) => fitDesignation(db, ro, de) }); setInvite({ ...invite, ...r.fields, archQ: '', copyNotes: r.notes, copiedName: a.name, reason: 'Coming back (details from the archive)' }); }}>Copy details</button></div>)}
        {invite.copiedName && <div className={'note small ' + (invite.copyNotes?.length ? 'warn' : 'ok')} style={{ marginTop: 8 }}>Details copied from {invite.copiedName}'s archived account{invite.copyNotes?.length ? ':' : ' — everything still fits.'}{(invite.copyNotes || []).map((n) => <div key={n}>{n}</div>)}</div>}
      </div>}
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Full name" req><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></Field>
        <Field label="Sign-in ID (Gmail / email or mobile)" req><Input value={invite.identifier} onChange={(e) => setInvite({ ...invite, identifier: e.target.value })} /></Field>
        {idType(invite.identifier) === 'MOBILE' && <Field label="Gmail for account emails"><Input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>}
        <Field label={'Role' + (departmentOf(db, invite.role) ? ' · ' + departmentOf(db, invite.role) : '')}><Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value, designation: fitDesignation(db, e.target.value, invite.designation) })} options={roles.filter((r) => r.code !== 'PLATFORM').map((r) => [r.code, r.name])} /></Field>
        {invite.role === 'PARENT' ? <Field label="Designation"><Input value="N/A" disabled aria-label="Designation: N/A" /></Field>
          : <Field label="Designation (for this role)"><Select value={invite.designation} onChange={(e) => setInvite({ ...invite, designation: e.target.value })} options={[['', 'Pick a designation'], ...designationsFor(db, invite.role)]} /></Field>}
        {invite.role === 'PARENT' && <>
          <Field label="Student's admission no." req><Input value={invite.admissionNo || ''} onChange={(e) => setInvite({ ...invite, admissionNo: e.target.value.toUpperCase() })} placeholder="ADM-2025-0231" /></Field>
          <Field label="Student's name" req><Input value={invite.studentName} onChange={(e) => setInvite({ ...invite, studentName: e.target.value })} /></Field>
          <Field label="Student's grade" req><Select value={invite.grade} onChange={(e) => setInvite({ ...invite, grade: e.target.value })} options={[['', 'Pick a grade'], ...gradeOptions(db)]} /></Field></>}
        <Field label="Why is this person being added instead of registering?" req><Select value={invite.reason} onChange={(e) => setInvite({ ...invite, reason: e.target.value })} options={[['', 'Pick a reason'], ...ADD_REASONS.map((x) => [x, x])]} /></Field>
        {invite.reason === 'Other' && <Field label="Reason" req><Input value={invite.reasonText || ''} onChange={(e) => setInvite({ ...invite, reasonText: e.target.value })} /></Field>}
      </div>
      <p className="small muted">They get an email with their account details and a link to set their own password. Passwords are never emailed.{invite.role === 'PARENT' ? ' The student details are checked against the student record.' : ''}</p>
    </Modal>}
  </Page>;
}

// Deleted accounts, kept for reference. View only.
function UserArchive() {
  const { db } = useStore();
  const arch = db.userArchive || [];
  const [q, setQ] = useState('');
  const [rf, setRf] = useState('');
  const [df, setDf] = useState('');
  const [why, setWhy] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const filter = (fn) => (e) => { fn(e.target.value); setPage(0); };
  const roles = [...new Map(arch.map((a) => [a.role, a.roleName])).entries()];
  const depts = [...new Set(arch.map((a) => a.department).filter(Boolean))].sort();
  const list = arch.filter((a) => (!rf || a.role === rf) && (!df || a.department === df) && (!why || a.reason === why)
    && (!from || a.deletedAt.slice(0, 10) >= from) && (!to || a.deletedAt.slice(0, 10) <= to)
    && (!q || (a.name + a.login + a.email + a.mobile + (a.designation || '') + a.children.map((k) => k.adm + k.name).join(' ')).toLowerCase().includes(q.toLowerCase())));
  const pg = Math.min(page, Math.max(0, Math.ceil(list.length / PAGE) - 1));
  return <>
    <p className="small muted">Accounts that were deleted, kept for reference (view only). When people delete their own account, their sign-in ID, email and mobile are not kept.</p>
    <div className="row" style={{ marginBottom: 12 }}>
      <Input placeholder="Search name, email, mobile, designation, student" aria-label="Search archive" value={q} onChange={filter(setQ)} style={{ minWidth: 260 }} />
      <Select aria-label="Archive role filter" value={rf} onChange={filter(setRf)} options={[['', 'All roles'], ...roles]} />
      <Select aria-label="Archive department filter" value={df} onChange={filter(setDf)} options={[['', 'All departments'], ...depts.map((x) => [x, x])]} />
      <Select aria-label="Reason filter" value={why} onChange={filter(setWhy)} options={[['', 'All reasons'], ...ARCHIVE_REASONS.map((x) => [x, x])]} />
      <label className="row small">Deleted from <Input type="date" aria-label="Deleted from" value={from} onChange={filter(setFrom)} /></label>
      <label className="row small">to <Input type="date" aria-label="Deleted to" value={to} onChange={filter(setTo)} /></label></div>
    {!arch.length ? <Card><p className="muted">No deleted accounts yet. When an account is deleted, a copy is kept here.</p></Card> : <>
    <div className="tw"><table className="t" aria-label="Archived users"><thead><tr><th>Name</th><th>Sign-in ID</th><th>Role</th><th>Department</th><th>Designation</th><th>Student (parents)</th><th>Email</th><th>Mobile</th><th>Created</th><th>Last sign-in</th><th>Deleted on</th><th>Reason</th><th>Deleted by</th></tr></thead>
      <tbody>{list.slice(pg * PAGE, pg * PAGE + PAGE).map((a) => <tr key={a.id}><td className="b">{a.name}</td><td>{a.login || <span className="muted">Not kept</span>}</td><td>{a.roleName}</td><td>{a.department || '—'}</td>
        <td>{a.role === 'PARENT' ? 'N/A' : a.designation || '—'}</td>
        <td className="small">{a.children.length ? a.children.map((k) => <div key={k.adm}><b>{k.name}</b> · {k.grade}<div className="muted">{k.adm}</div></div>) : '—'}</td>
        <td className="small">{a.email || <span className="muted">{a.self ? 'Not kept' : '—'}</span>}</td><td className="small">{a.mobile || <span className="muted">{a.self ? 'Not kept' : '—'}</span>}</td>
        <td className="small">{a.createdAt ? dmon(a.createdAt) : '—'}</td><td className="small">{a.lastLogin ? dmon(a.lastLogin) : '—'}</td>
        <td className="small">{dmon(a.deletedAt)}</td><td className="small">{a.reason}</td><td className="small">{a.deletedBy}</td></tr>)}</tbody></table></div>
    <Pager page={pg} total={list.length} onPage={setPage} label="archived accounts" /></>}
  </>;
}

export function Roles() {
  const [tab, setTab] = useState('users');
  return <Page title="Roles & permissions" sub="User management: each user profile, its department and designations. Permissions: what each department can open — no access, read only or full access, for a whole menu or single sub-menus. Access summary: what each person can open, and why.">
    <Tabs tabs={[['users', 'User management'], ['matrix', 'Permissions by department'], ['summary', 'Access summary']]} value={tab} onChange={setTab} />
    {tab === 'users' && <UserProfiles goMatrix={() => setTab('matrix')} />}
    {tab === 'matrix' && <DeptPermissions />}
    {tab === 'summary' && <AccessSummary />}
  </Page>;
}

const LEVELS = [['NONE', 'No access'], ['READ', 'Read only'], ['FULL', 'Full access']];
const LEVEL_NAME = { FULL: 'Full access', READ: 'Read only', NONE: 'No access' };
function LevelSelect({ value, onChange, label, disabled }) {
  return <select className={'lvl ' + (value === 'FULL' ? 'full' : value === 'READ' ? 'read' : '')} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
    {value === 'MIXED' && <option value="MIXED" disabled>Mixed</option>}
    {LEVELS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>;
}

// Roles & Permissions → Permissions by department: pick a department, then set No access / Read only / Full access
// for a whole main menu (every sub-menu under it), a group inside it, or single sub-menus. All levels start collapsed.
function DeptPermissions() {
  const { db, run, notify, session } = useStore();
  const depts = departments(db);
  const [sel, setSel] = useState(() => (depts.find((d) => !d.profiles.some((p) => p.code === 'ADMIN')) || depts[0]).name);
  const [open, setOpen] = useState({});
  const t = tenantOf(db);
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  const dept = depts.find((d) => d.name === sel) || depts[0];
  const screens = new Set(db.deptPerms?.[dept.name] || rolePerms(db, dept.profiles[0].code));
  const ro = new Set(db.deptReadOnly?.[dept.name] || []);
  const hasAdmin = dept.profiles.some((p) => p.code === 'ADMIN');
  const others = dept.profiles.filter((p) => p.code !== 'ADMIN');
  const who = session.name || session.role;
  const mods = MENU.filter((m) => !PROVIDER_MODULES.includes(m.code));
  const groupsOf = (m) => { const out = []; let cur = { key: m.code + ':_', title: null, items: [] };
    for (const i of m.items) { if (i[0][0] === '#') { if (cur.items.length || cur.title) out.push(cur); cur = { key: m.code + ':' + i[0], title: i[1], items: [] }; } else cur.items.push(i); }
    out.push(cur); return out.filter((g) => g.items.length); };
  const levelOf = (c) => (!screens.has(c) ? 'NONE' : ro.has(c) ? 'READ' : 'FULL');
  const levelOfAll = (codes) => { const l = [...new Set(codes.map(levelOf))]; return l.length === 1 ? l[0] : 'MIXED'; };
  const countOf = (codes) => { const f = codes.filter((c) => levelOf(c) === 'FULL').length, r = codes.filter((c) => levelOf(c) === 'READ').length;
    return [f && `${f} full`, r && `${r} read only`].filter(Boolean).join(' · ') || 'none'; };
  const set = (codes, level) => {
    const list = codes.filter((c) => !c.startsWith('VA_'));
    run((d) => {
      syncDeptPerms(d);
      const cur = new Set(d.deptPerms[dept.name]); const r = new Set(d.deptReadOnly?.[dept.name] || []);
      list.forEach((c) => { if (level === 'NONE') { cur.delete(c); r.delete(c); } else { cur.add(c); if (level === 'READ') r.add(c); else r.delete(c); } });
      d.deptPerms = { ...d.deptPerms, [dept.name]: [...cur] };
      d.deptReadOnly = { ...(d.deptReadOnly || {}), [dept.name]: [...r] };
      log(d, who, 'Department access changed', `${dept.name}: ${list.length === 1 ? LABEL[list[0]] : list.length + ' screens'} → ${LEVEL_NAME[level]}`);
    });
  };
  const reset = () => { const from = others[0]?.code; if (!from) return; run((d) => { syncDeptPerms(d); d.deptPerms = { ...d.deptPerms, [dept.name]: defaultScreens(d, from) }; d.deptReadOnly = { ...(d.deptReadOnly || {}), [dept.name]: [] }; log(d, who, 'Department access reset', dept.name); }); notify(`${dept.name}: back to the standard screens for ${roleName(db, baseRoleOf(db, from))}, all full access`); };
  const toggle = (k) => setOpen({ ...open, [k]: !open[k] });
  const Chevron = ({ k, label }) => <button className="tree-tg" aria-expanded={!!open[k]} aria-label={(open[k] ? 'Collapse ' : 'Expand ') + label} onClick={() => toggle(k)}>{open[k] ? '▾' : '▸'}</button>;
  return <div className="grid dept-grid" style={{ marginTop: 12, alignItems: 'start' }}>
    <Card title="Departments">
      <p className="small muted">Departments come from User management — add a profile with a new department and it appears here.</p>
      <div className="dept-list" role="listbox" aria-label="Departments">{depts.map((d) => { const onlyAdmin = d.profiles.some((p) => p.code === 'ADMIN') && d.profiles.length === 1; const list = db.deptPerms?.[d.name] || rolePerms(db, d.profiles[0].code); const nr = (db.deptReadOnly?.[d.name] || []).filter((c) => list.includes(c) && LABEL[c]).length;
        return <button key={d.name} role="option" aria-selected={d.name === dept.name} className={'dept-item' + (d.name === dept.name ? ' on' : '')} onClick={() => setSel(d.name)}>
          <b>{d.name}</b><span className="small muted">{d.profiles.map((p) => p.name).join(', ')} · {onlyAdmin ? 'All' : list.filter((c) => LABEL[c]).length} screens{nr ? ` (${nr} read only)` : ''}</span></button>; })}</div>
    </Card>
    <Card title={`What ${dept.name} can open`} right={others.length > 0 && <button className="btn sm" onClick={reset}>Reset to standard</button>}>
      <p className="small">Profiles in this department: <b>{dept.profiles.map((p) => p.name).join(', ')}</b>. Set a main menu to give every sub-menu under it the same access, or open it and set sub-menus one by one. <b>Read only</b>: the screen opens, but nothing on it can be saved.</p>
      {hasAdmin && <p className="small pill info" style={{ display: 'block' }}>The Admin profile always has full access to every screen.{others.length ? ' These settings apply to the other profiles in this department.' : ' Settings here apply to any profile added to this department later.'}</p>}
      <div className="tree" role="tree" aria-label={`Menus for ${dept.name}`}>{mods.map((m) => { const codes = m.items.filter((i) => i[0][0] !== '#').map((i) => i[0]); const isVa = m.code === 'VIEWAS';
        return <div key={m.code} role="treeitem" aria-expanded={!!open[m.code]} className="tree-mod">
          <div className="tree-row mod-row"><Chevron k={m.code} label={m.label} /><b style={{ flex: 1 }}>{m.label}</b>
            <span className="small muted">{isVa ? 'Admin only' : countOf(codes)}</span>
            <LevelSelect value={isVa ? (hasAdmin ? 'FULL' : 'NONE') : levelOfAll(codes)} disabled={isVa} label={'Access to all of ' + m.label} onChange={(v) => set(codes, v)} /></div>
          {open[m.code] && <div role="group">{groupsOf(m).map((g) => { const gc = g.items.map((i) => i[0]);
            const rows = g.items.map((i) => { const inPlan = canSee(i[0], 'ADMIN', rank, t.overrides, null) || ['SELF_CHILD', 'SELF_FEES', 'SELF_MYPERF'].includes(i[0]) || i[0].startsWith('VA_');
              return <div key={i[0]} role="treeitem" className={'tree-row leaf' + (g.title ? ' deep' : '')}><span style={{ flex: 1 }}>{i[1]}</span>
                {!inPlan && <span className="pill">Not in plan</span>}
                <LevelSelect value={isVa ? (hasAdmin ? 'FULL' : 'NONE') : levelOf(i[0])} disabled={isVa} label={'Access to ' + i[1]} onChange={(v) => set([i[0]], v)} /></div>; });
            return g.title ? <div key={g.key} role="treeitem" aria-expanded={!!open[g.key]}>
              <div className="tree-row grp-row"><Chevron k={g.key} label={m.label + ' ' + g.title} /><span style={{ flex: 1 }}>{g.title}</span>
                <span className="small muted">{countOf(gc)}</span>
                <LevelSelect value={isVa ? 'NONE' : levelOfAll(gc)} disabled={isVa} label={'Access to all of ' + g.title} onChange={(v) => set(gc, v)} /></div>
              {open[g.key] && <div role="group">{rows}</div>}</div> : <div key={g.key}>{rows}</div>; })}</div>}
        </div>; })}</div>
    </Card>
  </div>;
}

// Roles & Permissions → Access summary: each person, their profile, department and designation, and what they can open
function AccessSummary() {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [dep, setDep] = useState('');
  const [prof, setProf] = useState('');
  const [openRow, setOpenRow] = useState(null);
  const people = db.users.filter((u) => u.role && !isProvider(u.role) && u.status !== 'DELETED' && allRoles(db).some((r) => r.code === u.role));
  const deptNames = departments(db).map((d) => d.name);
  const rows = people.map((u) => {
    const codes = u.role === 'ADMIN' ? MENU.flatMap((m) => m.items.map((i) => i[0])).filter((c) => c[0] !== '#' && !c.startsWith('PLT_') && (ACCESS.ADMIN.includes(c))) : screensFor(db, u, u.role).filter((c) => LABEL[c]);
    const lv = codes.map((c) => [c, accessLevel(db, u, u.role, c)]).filter(([, l]) => l);
    return { u, dept: departmentOf(db, u.role), lv, full: lv.filter(([, l]) => l === 'FULL').length, read: lv.filter(([, l]) => l === 'READ').length };
  }).filter((r) => (!dep || r.dept === dep) && (!prof || r.u.role === prof) && (!q || `${r.u.name} ${r.u.designation || ''} ${r.u.email || ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.dept.localeCompare(b.dept) || a.u.name.localeCompare(b.u.name));
  return <>
    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
      <Input placeholder="Search name or designation" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" style={{ maxWidth: 280 }} />
      <Select aria-label="Department" value={dep} onChange={(e) => setDep(e.target.value)} options={[['', 'All departments'], ...deptNames.map((n) => [n, n])]} />
      <Select aria-label="Profile" value={prof} onChange={(e) => setProf(e.target.value)} options={[['', 'All profiles'], ...allRoles(db).filter((r) => !isProvider(r.code)).map((r) => [r.code, r.name])]} />
      <span className="small muted">{rows.length} people</span>
    </div>
    <div className="tw" style={{ marginTop: 10, maxHeight: 'none' }}><table className="t"><thead><tr><th>Name</th><th>Profile</th><th>Department</th><th>Designation</th><th>Full access</th><th>Read only</th><th /></tr></thead>
      <tbody>{rows.map((r) => [<tr key={r.u.id}>
        <td><b>{r.u.name}</b><div className="small muted">{r.u.email || r.u.mobile || ''}{r.u.status !== 'ACTIVE' ? ' · ' + r.u.status.toLowerCase() : ''}</div></td>
        <td>{roleName(db, r.u.role)}</td><td>{r.dept}</td><td>{designationLabel(r.u)}</td>
        <td><span className="pill badge-full">{r.u.role === 'ADMIN' ? 'All screens' : r.full}</span></td>
        <td>{r.read ? <span className="pill badge-read">{r.read}</span> : <span className="muted">—</span>}</td>
        <td><button className="btn sm" aria-expanded={openRow === r.u.id} aria-label={(openRow === r.u.id ? 'Hide' : 'Show') + ' access of ' + r.u.name} onClick={() => setOpenRow(openRow === r.u.id ? null : r.u.id)}>{openRow === r.u.id ? 'Hide' : 'Show'} access</button></td></tr>,
        openRow === r.u.id && <tr key={r.u.id + '-d'}><td colSpan={7} style={{ background: 'var(--bg)' }}>
          <div className="grid g3" style={{ gap: 10 }}>{MENU.filter((m) => !PROVIDER_MODULES.includes(m.code)).map((m) => { const items = m.items.filter((i) => i[0][0] !== '#').map((i) => [i, r.lv.find(([c]) => c === i[0])?.[1]]).filter(([, l]) => l);
            return items.length ? <div key={m.code} className="card" style={{ padding: 10 }}><b>{m.label}</b>
              {items.map(([i, l]) => <div key={i[0]} className="row small" style={{ justifyContent: 'space-between', padding: '3px 0' }} title={accessSource(db, r.u, r.u.role, i[0])}>
                <span>{i[1]}</span><span className={'pill ' + (l === 'FULL' ? 'badge-full' : 'badge-read')}>{l === 'FULL' ? 'Full' : 'Read only'}</span></div>)}</div> : null; })}</div>
          <p className="small muted" style={{ marginTop: 8 }}>Access comes from the department ({r.dept}){r.u.designation && db.designationAccess?.[r.u.designation]?.length ? `, the designation ${r.u.designation}` : ''}{r.u.extra?.length ? ' and screens given to this person' : ''}. Hover a screen to see why.</p>
        </td></tr>])}</tbody></table></div>
  </>;
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
          <Field label="Show under"><Select value={f.under} onChange={(e) => setF({ ...f, under: e.target.value })} options={[['TOP', 'Top of the menu'], ...MENU.filter((m) => !PROVIDER_MODULES.includes(m.code)).map((m) => [m.code, m.label])]} /></Field>
          <div className="row small">{ROLES.filter((r) => !isProvider(r.code)).map((r) => <label key={r.code} className="row"><input type="checkbox" checked={f.roles.includes(r.code)} onChange={() => setF({ ...f, roles: f.roles.includes(r.code) ? f.roles.filter((x) => x !== r.code) : [...f.roles, r.code] })} />{r.name}</label>)}</div>
          <button className="btn pri" disabled={!ok} onClick={() => { run((d) => { d.links.push({ ...f, id: 'L' + Date.now(), open: 'NEW_TAB' }); log(d, session.role, 'Menu link added', f.label); }); setF({ ...f, label: '', url: 'https://' }); notify('Link added to the menu'); }}>Add link</button>
        </div>
      </Card>
    </div>
    <WebsiteDeepLinks />
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
  const isOn = (code, min) => (t.overrides[code] !== undefined ? t.overrides[code] : planDefault(code, rank, min));
  const toggle = (code, min) => mutate((d) => { const x = d.tenants.find((y) => y.id === sel); const now = x.overrides[code] !== undefined ? x.overrides[code] : planDefault(code, rank, min); x.overrides = { ...x.overrides, [code]: !now }; });
  return <Page title="Schools & plans" sub="Your company's console. Plan sets the default switches; turn any module or sub-menu on (add-on) or off per school.">
    <div className="grid" style={{ gridTemplateColumns: '300px 1fr' }}>
      <Card title="Schools">{db.tenants.map((x) => <button key={x.id} className={'btn' + (sel === x.id ? ' pri' : '')} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => setSel(x.id)}>{x.name}<div className="small" style={{ opacity: .8 }}>{PLANS.find((p) => p.code === x.plan).name} · {x.subdomain}.yourapp.com</div></button>)}</Card>
      <div>
        <Card title={t.name} right={<Select value={t.plan} onChange={(e) => { mutate((d) => { d.tenants.find((y) => y.id === sel).plan = e.target.value; }); notify('Plan changed — menus update straight away'); }} options={PLANS.map((p) => [p.code, `${p.name} (${p.range})`])} />}>
          <p className="small muted">Renews {t.renews}. Changes are written to the config audit log. Sign in to this school as any role to see the result.</p>
          {MENU.filter((m) => ![...PROVIDER_MODULES, 'SELF'].includes(m.code)).map((m) => <div key={m.code} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
            <div className="row">{ALWAYS_ON.includes(m.code) ? <span className="pill">Always on</span> : <Switch on={isOn(m.code, m.min)} label={m.label} onClick={() => toggle(m.code, m.min)} />}<b>{m.label}</b>{t.overrides[m.code] !== undefined && <span className="pill info">{t.overrides[m.code] ? 'Add-on' : 'Switched off'}</span>}</div>
            {(ALWAYS_ON.includes(m.code) || isOn(m.code, m.min)) && <div className="row" style={{ paddingLeft: 44, marginTop: 6 }}>{m.items.filter((i) => i[0][0] !== '#').map((i) => <label key={i[0]} className="row small" style={{ marginRight: 10 }}>
              <input type="checkbox" checked={isOn(i[0], i[2])} onChange={() => toggle(i[0], i[2])} />{i[1]}{t.overrides[i[0]] && rank < i[2] ? ' (add-on)' : ''}{!isOn(i[0], i[2]) && rank < i[2] ? <span className="muted"> · {PLANS[i[2] - 1].name}+</span> : ''}</label>)}</div>}
          </div>)}
          <h3 style={{ marginTop: 16 }}>Functions</h3>
          <p className="small muted">Optional capabilities inside modules. Ones marked “optional” are off unless you switch them on for this school.</p>
          {FUNCTIONS.map((f) => { const on = funcOn(t, f.code); return <div key={f.code} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
            <Switch on={on} label={f.name} onClick={() => mutate((d) => { const x = d.tenants.find((y) => y.id === sel); x.overrides = { ...x.overrides, [f.code]: !on }; })} />
            <span style={{ flex: 1 }}>{f.name} <span className="small muted">· {MENU.find((m) => m.code === f.module)?.label}</span></span>
            <span className="pill">{f.minRank === null ? 'Optional — off by default' : `In ${PLANS[f.minRank - 1].name}+`}</span>
            {t.overrides[f.code] !== undefined && <span className="pill info">{t.overrides[f.code] ? 'Switched on' : 'Switched off'}</span>}</div>; })}
          <div className="row end" style={{ marginTop: 10 }}><button className="btn" onClick={() => mutate((d) => { d.tenants.find((y) => y.id === sel).overrides = {}; })}>Back to plan defaults</button></div>
        </Card>
        <Card title="Mobile app (Play Store & App Store)" right={<Switch on={!!t.mobile?.enabled} label="Mobile app for this school" onClick={() => mutate((d) => { const x = d.tenants.find((y) => y.id === sel); x.mobile = { ...(x.mobile || {}), enabled: !x.mobile?.enabled }; })} />}>
          <p className="small muted">One app in the stores serves every school; parents and staff enter the school code <b>{t.code}</b> once. Which screens each role gets on the website and in the app is set in <b>Settings → Web & App Screens</b> (draft → approval → publish).</p>
          {t.mobile?.enabled ? <div className="small">
              <div>Layout: version {t.channels?.version || 1}{t.channels?.status === 'PENDING' ? ' · a change is waiting for approval' : t.channels?.draft ? ' · a draft is being edited' : ''}</div>
              <ul style={{ paddingLeft: 18, margin: '6px 0' }}>{['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL'].map((r) => <li key={r}><b>{ROLES.find((x) => x.code === r).name}:</b> {mobileTabs(t, r, { [r]: db.perms?.[r] || ACCESS[r] }).map((x) => x[1]).join(', ')}</li>)}</ul></div>
            : <p className="small">Switched off. People from this school who open the app are told to use the website.</p>}
          <div className="row" style={{ marginTop: 8 }}><a className="btn sm" href="#/s/OPS_CHANNELS">Web & App Screens</a><a className="btn sm" href="#/p/mobile" target="_blank" rel="noreferrer">Preview the mobile app</a><span className="small muted">Status: {t.mobile?.appStatus || 'Not published'}</span></div>
        </Card>
      </div>
    </div>
  </Page>;
}

export function MyPrefs() {
  const { db, session } = useStore();
  return <Page title="My preferences"><Card><p>Language: English · Notifications: email and app · Templates you use:</p>
    <table className="t"><tbody>{CATEGORIES.map((c) => <tr key={c.code}><td>{c.name}</td><td>{resolveTemplate(db, c.code, session.role)?.name}</td></tr>)}</tbody></table>
    <p className="small muted">Change your own template choice in Settings → Templates (“My default”).</p></Card></Page>;
}

export { LABEL };

// Links and snippets the school pastes into its own website
function WebsiteDeepLinks() {
  const { db, notify } = useStore();
  const [show, setShow] = useState('p/apply');
  const here = typeof location !== 'undefined' && /^https?:/.test(location.href) ? location.href.split('#')[0] : null;
  const copy = (text) => { try { navigator.clipboard.writeText(text); notify('Copied'); } catch (e) { notify('Select the text and copy it'); } };
  const url = linkFor(db, show);
  const label = WEBSITE_LINKS.find((l) => l[0] === show)[1];
  return <Card title="Links for the school website" right={<span className="small muted">Each school gets its own addresses</span>}>
    <p className="small muted">Put these on the school's website. A parent clicking “Requests to school” signs in and lands on that page; what they can see is still decided by their role. The admission form works without signing in.</p>
    <div className="tw"><table className="t"><thead><tr><th>Page</th><th>For</th><th>Address</th><th /></tr></thead>
      <tbody>{WEBSITE_LINKS.map(([path, name, who]) => <tr key={path}><td className="b">{name}</td><td className="small">{who}</td><td className="small"><code>{linkFor(db, path)}</code></td>
        <td><div className="row"><button className="btn sm" onClick={() => copy(linkFor(db, path))}>Copy link</button><button className="btn sm" onClick={() => setShow(path)} aria-pressed={show === path}>Snippet</button>{here && <a className="btn sm" href={'#/' + path} target="_blank" rel="noreferrer">Try it</a>}</div></td></tr>)}</tbody></table></div>
    <div className="grid g2" style={{ marginTop: 10 }}>
      <Field label={`Button for “${label}”`}><textarea className="i" readOnly rows={4} value={buttonSnippet(url, label)} onFocus={(e) => e.target.select()} /></Field>
      {show === 'p/apply' ? <Field label="Embed the form inside a website page"><textarea className="i" readOnly rows={4} value={iframeSnippet(url)} onFocus={(e) => e.target.select()} /></Field>
        : <p className="small muted">Screens behind sign-in are linked, not embedded, so a parent's session is never shown inside another site.</p>}
    </div>
  </Card>;
}

// Roles & Permissions → User management: every user profile (role), the department it belongs to,
// the designations offered for it (sign-up, Add user, Edit user) and how many people have it. New profiles are added here.
function UserProfiles({ goMatrix }) {
  const { db, run, notify, session } = useStore();
  const [add, setAdd] = useState({});
  const [dept, setDept] = useState(null);                      // { role, name } while changing a department
  const [confirm, setConfirm] = useState(null);                // { kind: 'designation' | 'profile', role, name }
  const [nr, setNr] = useState({ name: '', department: '', from: 'TEACHER', designations: '' });
  const t = tenantOf(db);
  const who = session.name || session.role;
  const profiles = allRoles(db).filter((r) => !isProvider(r.code));
  const deptNames = departments(db).map((d) => d.name);
  const count = (code) => db.users.filter((u) => (u.role === code || (!u.role && u.requestedRole === code)) && u.status !== 'DELETED').length;
  const holders = (role, name) => db.users.filter((u) => u.role === role && u.designation === name && u.status !== 'DELETED').length;
  const save = (role) => {
    const name = (add[role] || '').trim();
    if (name.length < 2) return;
    if (designationsFor(db, role).some((x) => x.toLowerCase() === name.toLowerCase())) { notify('Already in the list'); return; }
    run((d) => {
      const back = (d.roleDesignationsRemoved?.[role] || []).find((x) => x.toLowerCase() === name.toLowerCase());
      if (back) d.roleDesignationsRemoved = { ...d.roleDesignationsRemoved, [role]: d.roleDesignationsRemoved[role].filter((x) => x !== back) };
      if (!back || !designationsFor(d, role).includes(back)) d.roleDesignations = { ...(d.roleDesignations || {}), [role]: [...(d.roleDesignations?.[role] || []), back || name] };
      log(d, who, 'Designation added', `${back || name} (${roleName(d, role)})`);
    });
    setAdd({ ...add, [role]: '' }); notify('Added');
  };
  // Removing asks first; it is refused while someone holds the designation or if it is the last one
  const askRemove = (role, name) => {
    const n = holders(role, name);
    if (n) { notify(`${n} ${n === 1 ? 'person has' : 'people have'} “${name}” — change their designation in Users first`); return; }
    if (designationsFor(db, role).length <= 1) { notify('A profile needs at least one designation — add another first'); return; }
    setConfirm({ kind: 'designation', role, name });
  };
  const doRemoveDesignation = ({ role, name }) => {
    run((d) => {
      d.roleDesignations = { ...(d.roleDesignations || {}), [role]: (d.roleDesignations?.[role] || []).filter((x) => x !== name) };
      if (designationsFor(d, role).includes(name)) d.roleDesignationsRemoved = { ...(d.roleDesignationsRemoved || {}), [role]: [...(d.roleDesignationsRemoved?.[role] || []), name] };
      log(d, who, 'Designation removed', `${name} (${roleName(d, role)})`);
    });
    notify(`Removed “${name}” — it is no longer offered for ${roleName(db, role)}`);
  };
  const askDeleteProfile = (r) => {
    const n = count(r.code);
    if (n) { notify(`${n} ${n === 1 ? 'person has' : 'people have'} the ${r.name} profile — move them to another profile in Users first`); return; }
    setConfirm({ kind: 'profile', role: r.code, name: r.name });
  };
  const doDeleteProfile = ({ role, name }) => {
    run((d) => {
      if ((d.customRoles || []).some((x) => x.code === role)) d.customRoles = d.customRoles.filter((x) => x.code !== role);
      else d.removedProfiles = [...new Set([...(d.removedProfiles || []), role])];
      log(d, who, 'Profile deleted', name);
    });
    notify(`Deleted the ${name} profile`);
  };
  const restore = (code) => { run((d) => { d.removedProfiles = (d.removedProfiles || []).filter((x) => x !== code); syncDeptPerms(d); log(d, who, 'Profile restored', roleName(d, code)); }); notify(`${roleName(db, code)} restored`); };
  const saveDept = () => {
    const name = dept.name.trim(); if (name.length < 2) { notify('Enter a department name'); return; }
    const joins = deptNames.includes(name) && name !== departmentOf(db, dept.role);
    run((d) => {
      const before = rolePerms(d, dept.role);
      if (!d.deptPerms?.[name]) d.deptPerms = { ...(d.deptPerms || {}), [name]: [...before] };   // a new department keeps this profile's screens
      const custom = (d.customRoles || []).find((x) => x.code === dept.role);
      if (custom) custom.department = name; else d.roleDepartments = { ...(d.roleDepartments || {}), [dept.role]: name };
      syncDeptPerms(d);
      log(d, who, 'Department changed', `${roleName(d, dept.role)} → ${name}`);
    });
    setDept(null); notify(joins ? `${roleName(db, dept.role)} joined ${name} and now opens that department's screens` : 'Department saved');
  };
  const addProfile = (spec) => {
    const p = spec || { name: nr.name.trim(), department: nr.department.trim(), from: nr.from, designations: nr.designations.split(',').map((x) => x.trim()).filter((x) => x.length > 1) };
    const code = 'R_' + p.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20);
    if (allRoles(db).some((r) => r.code === code || r.name.toLowerCase() === p.name.toLowerCase())) { notify('A profile with that name exists'); return; }
    const department = p.department || departmentOf(db, p.from);
    run((d) => {
      d.customRoles.push({ code, name: p.name, basedOn: p.from, department });
      if (p.designations.length) d.roleDesignations = { ...(d.roleDesignations || {}), [code]: p.designations };
      if (!d.deptPerms?.[department]) d.deptPerms = { ...(d.deptPerms || {}), [department]: defaultScreens(d, p.from) };
      syncDeptPerms(d);
      log(d, who, 'Profile added', `${p.name} · ${department}`);
    });
    notify(deptNames.includes(department) ? `${p.name} added to ${department} — it opens that department's screens` : `${p.name} added with a new department, ${department}`);
    if (!spec) setNr({ name: '', department: '', from: 'TEACHER', designations: '' });
  };
  const removedBuiltIns = (db.removedProfiles || []);
  const suggestions = STANDARD_PROFILES.filter((sp) => !allRoles(db).some((r) => r.name.toLowerCase() === sp.name.toLowerCase()));
  return <>
    <div className="tw" style={{ marginTop: 12, maxHeight: 'none' }}><table className="t"><thead><tr><th>User profile</th><th>Department</th><th>Designations offered</th><th>People</th><th>Screens</th><th /></tr></thead>
      <tbody>{profiles.map((r) => { const list = designationsFor(db, r.code);
        return <tr key={r.code}>
          <td><b>{r.name}</b>{!r.builtIn && <div className="small muted">Added by the school · from {roleName(db, r.basedOn)}</div>}</td>
          <td style={{ minWidth: 200 }}>{dept?.role === r.code
            ? <div className="row"><Input list="dept-names" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveDept()} aria-label={'Department for ' + r.name} autoFocus /><button className="btn sm pri" onClick={saveDept}>Save</button><button className="btn sm" onClick={() => setDept(null)}>Cancel</button></div>
            : <div className="row">{departmentOf(db, r.code) || <span className="muted">—</span>}{r.code !== 'PARENT' && <button className="btn sm" aria-label={'Change department of ' + r.name} onClick={() => setDept({ role: r.code, name: departmentOf(db, r.code) })}>Change</button>}</div>}</td>
          <td style={{ maxWidth: 520 }}>{r.code === 'PARENT' ? <span className="small">No designation — every parent is marked <b>Parent</b></span> : <>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{list.map((dname) => <span key={dname} className="pill">{dname}<button className="btn sm" style={{ marginLeft: 6, minHeight: 0, padding: '0 6px' }} aria-label={`Remove ${dname} from ${r.name}`} title={holders(r.code, dname) ? `${holders(r.code, dname)} with this designation — change theirs first` : 'Remove'} onClick={() => askRemove(r.code, dname)}>×</button></span>)}</div>
            <div className="row" style={{ marginTop: 6 }}><Input placeholder="Add a designation" value={add[r.code] || ''} onChange={(e) => setAdd({ ...add, [r.code]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save(r.code)} aria-label={'New designation for ' + r.name} /><button className="btn sm" onClick={() => save(r.code)}>Add</button></div></>}</td>
          <td>{count(r.code)}</td>
          <td>{r.code === 'ADMIN' ? 'All' : <button className="btn sm" title="Set in Permissions by department" onClick={goMatrix}>{rolePerms(db, r.code).filter((c) => LABEL[c]).length}</button>}</td>
          <td>{r.code !== 'ADMIN' && <button className="btn sm danger" aria-label={'Delete profile ' + r.name} title={count(r.code) ? 'Move its people to another profile first' : 'Delete this profile'} onClick={() => askDeleteProfile(r)}>Delete</button>}</td>
        </tr>; })}</tbody></table></div>
    <datalist id="dept-names">{deptNames.map((n) => <option key={n} value={n} />)}{STANDARD_PROFILES.map((sp) => sp.department).filter((n, i, a) => a.indexOf(n) === i && !deptNames.includes(n)).map((n) => <option key={n} value={n} />)}</datalist>
    {removedBuiltIns.length > 0 && <p className="small" style={{ marginTop: 8 }}>Deleted profiles: {removedBuiltIns.map((c) => <button key={c} className="btn sm" style={{ marginRight: 6 }} onClick={() => restore(c)}>Restore {roleName(db, c)}</button>)}</p>}
    <div style={{ height: 16 }} />
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Card title="Add a user profile">
        {!funcOn(t, 'FN_CUSTOM_ROLES') ? <p className="small">New profiles are part of the Professional plan and above (or as an add-on). The built-in profiles above work on every plan, and you can add designations to them.</p> : <>
          <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Profile name" req><Input value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} placeholder="e.g. Librarian, Hostel Warden, Transport Manager" /></Field>
            <Field label="Department"><Input list="dept-names" value={nr.department} onChange={(e) => setNr({ ...nr, department: e.target.value })} placeholder={departmentOf(db, nr.from)} /></Field>
            <Field label="If the department is new, start with the screens of"><Select value={nr.from} onChange={(e) => setNr({ ...nr, from: e.target.value })} options={allRoles(db).filter((r) => !['PLATFORM', 'SALES', 'ADMIN', 'PARENT'].includes(r.code) && r.builtIn).map((r) => [r.code, r.name])} /></Field>
            <Field label="Designations (comma separated)"><Input value={nr.designations} onChange={(e) => setNr({ ...nr, designations: e.target.value })} placeholder="e.g. Hostel Warden, Assistant Warden" /></Field>
          </div>
          <p className="small muted">An existing department: the profile opens that department's screens. A new department: it appears in Permissions by department, starting with the screens above.</p>
          <div className="row end"><button className="btn pri" disabled={nr.name.trim().length < 3} onClick={() => addProfile()}>Add profile</button></div></>}
      </Card>
      <Card title="Standard profiles for Indian schools" right={<span className="small muted">{suggestions.length} not added yet</span>}>
        <p className="small muted">Departments and designations common in CBSE, ICSE and state-board schools. Add one with a click, then adjust it above.</p>
        {suggestions.length === 0 ? <p className="small">All added.</p> : suggestions.map((sp) => <div key={sp.name} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <div><b>{sp.name}</b> <span className="small muted">· {sp.department}</span><div className="small muted">{sp.designations.join(', ')}</div></div>
          <button className="btn sm" disabled={!funcOn(t, 'FN_CUSTOM_ROLES')} aria-label={'Add ' + sp.name} onClick={() => addProfile(sp)}>Add</button></div>)}
      </Card>
    </div>
    {confirm && <Modal title={confirm.kind === 'designation' ? 'Remove this designation?' : 'Delete this profile?'} onClose={() => setConfirm(null)}
      actions={<><button className="btn" onClick={() => setConfirm(null)}>Cancel</button><button className="btn danger" onClick={() => { const c = confirm; setConfirm(null); (c.kind === 'designation' ? doRemoveDesignation : doDeleteProfile)(c); }}>{confirm.kind === 'designation' ? 'Remove' : 'Delete profile'}</button></>}>
      {confirm.kind === 'designation'
        ? <p>“<b>{confirm.name}</b>” will no longer be offered for <b>{roleName(db, confirm.role)}</b> in Add user, Edit user or sign-up. Nobody has it now. You can add it back later by typing it in again.</p>
        : <p>The <b>{confirm.name}</b> profile and its row will be removed. It will no longer be offered in Add user, sign-up or View as Profile. Nobody has it now.{(db.customRoles || []).some((x) => x.code === confirm.role) ? ' Its designations go with it.' : ' A built-in profile can be restored later.'}</p>}
    </Modal>}
  </>;
}
