// Help → FAQs, and Operations → Help Documents & FAQs (where the school adds its own documents and questions)
import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Tabs } from '../components/ui.jsx';
import { FAQS, FAQ_TOPICS } from '../data/faq.js';
import { LABEL, MENU } from '../data/menu.js';
import { allRoles, roleName } from '../lib/auth.js';
import { log } from '../lib/logic.js';
import { dmon } from '../lib/format.js';

const forRole = (roles, role) => roles.includes('ALL') || roles.includes(role) || (role === 'ADMIN' && !roles.every((r) => ['SALES', 'PLATFORM'].includes(r)));
export const docsFor = (db, role) => (db.helpDocs || []).filter((d) => forRole(d.roles, role));

export function Faqs() {
  const { db, session } = useStore();
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const all = [...FAQS, ...(db.schoolFaqs || []).map((f) => ({ ...f, school: true }))].filter((f) => forRole(f.roles, session.role));
  const topics = [...new Set([...FAQ_TOPICS, ...all.map((f) => f.topic)])].filter((t) => all.some((f) => f.topic === t));
  const list = all.filter((f) => (!topic || f.topic === topic) && (!q || (f.q + ' ' + f.a).toLowerCase().includes(q.toLowerCase())));
  const docs = docsFor(db, session.role);
  return <Page title="Frequently asked questions" sub="The questions people ask most, for your role. Your school adds its own questions and documents in Operations → Help Documents & FAQs.">
    <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
      <Input placeholder="Search the questions" aria-label="Search the questions" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }} />
      <button className={'btn sm' + (!topic ? ' pri' : '')} onClick={() => setTopic('')}>All topics</button>
      {topics.map((t) => <button key={t} className={'btn sm' + (topic === t ? ' pri' : '')} onClick={() => setTopic(t)}>{t}</button>)}
    </div>
    {topics.filter((t) => list.some((f) => f.topic === t)).map((t) => <Card key={t} title={t} className="faq">
      {list.filter((f) => f.topic === t).map((f) => <details key={f.id}><summary>{f.q}{f.school && <span className="pill info" style={{ marginLeft: 8 }}>From the school</span>}</summary><p style={{ margin: '6px 0 0' }}>{f.a}</p></details>)}
    </Card>)}
    {!list.length && <Card><p className="muted">No question matches “{q}”. Try fewer words, or ask the school office.</p></Card>}
    <Card title={`School documents (${docs.length})`}>
      {docs.length ? <table className="t"><tbody>{docs.map((d) => <tr key={d.id}><td className="b">{d.title}</td><td className="small muted">{LABEL[d.menu] || 'General'} · v{d.version} · {dmon(d.at)}</td>
        <td>{d.kind === 'FILE' ? <a className="btn sm" href={d.data} download={d.fileName}>Download</a> : <a className="btn sm" href={d.url} target="_blank" rel="noreferrer">Open ↗</a>}</td></tr>)}</tbody></table>
        : <p className="muted small">No documents yet.</p>}
    </Card>
  </Page>;
}

export function HelpDocs() {
  const { db, run, notify, session } = useStore();
  const [tab, setTab] = useState('docs');
  const [doc, setDoc] = useState(null);
  const [faq, setFaq] = useState(null);
  const roles = [['ALL', 'Everyone'], ...allRoles(db).filter((r) => !['PLATFORM', 'SALES'].includes(r.code)).map((r) => [r.code, r.name])];
  const menus = [['', 'General (no menu)'], ...MENU.flatMap((m) => m.items.filter((i) => i[0][0] !== '#' && !i[0].startsWith('VA_')).map((i) => [i[0], `${m.label} → ${i[1]}`]))];
  const who = (rs) => (rs.includes('ALL') ? 'Everyone' : rs.map((r) => roleName(db, r)).join(', '));
  const pickRoles = (cur, set) => <div className="row small" style={{ flexWrap: 'wrap' }}>{roles.map(([k, n]) => <label key={k} className="row"><input type="checkbox" checked={cur.includes(k)}
    onChange={(e) => set(e.target.checked ? (k === 'ALL' ? ['ALL'] : [...cur.filter((x) => x !== 'ALL'), k]) : cur.filter((x) => x !== k))} />{n}</label>)}</div>;
  const onFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1.5e6) { notify('Files up to 1.5 MB in the test build — use a link for bigger files'); return; }
    const rd = new FileReader(); rd.onload = () => setDoc({ ...doc, kind: 'FILE', data: rd.result, fileName: f.name, title: doc.title || f.name.replace(/\.[^.]+$/, '') }); rd.readAsDataURL(f);
  };
  const saveDoc = () => {
    const err = !doc.title?.trim() ? 'Give the document a title' : doc.kind === 'LINK' && !/^https:\/\/\S+\.\S+/.test(doc.url || '') ? 'Links must start with https://' : doc.kind === 'FILE' && !doc.data ? 'Choose a file' : !doc.roles.length ? 'Choose who can see it' : '';
    if (err) { notify(err); return; }
    run((d) => { d.helpDocs = d.helpDocs || [];
      if (doc.id) { const x = d.helpDocs.find((y) => y.id === doc.id); Object.assign(x, { ...doc, version: (x.version || 1) + 1, at: new Date().toISOString() }); }
      else d.helpDocs.unshift({ ...doc, id: 'HD' + (d.helpDocs.length + 1) + '-' + Date.now().toString(36), version: 1, addedBy: session.name || session.role, at: new Date().toISOString() });
      log(d, session.name || session.role, 'Help document saved', doc.title); });
    notify('Saved — it shows in Help → FAQs for the roles you chose'); setDoc(null);
  };
  const saveFaq = () => {
    const err = !faq.q?.trim() ? 'Write the question' : !faq.a?.trim() ? 'Write the answer' : !faq.topic?.trim() ? 'Pick or type a topic' : !faq.roles.length ? 'Choose who can see it' : '';
    if (err) { notify(err); return; }
    run((d) => { d.schoolFaqs = d.schoolFaqs || [];
      if (faq.id) Object.assign(d.schoolFaqs.find((y) => y.id === faq.id), faq); else d.schoolFaqs.push({ ...faq, id: 'SF' + Date.now().toString(36), addedBy: session.name || session.role }); });
    notify('Saved — it shows in Help → FAQs'); setFaq(null);
  };
  return <Page title="Help documents & FAQs" sub="Add the school's own documents (calendar, handbook, policies, conversion notes, future guides) and its own frequently asked questions. They appear in Help → FAQs for the roles you choose."
    actions={tab === 'docs' ? <button className="btn pri" onClick={() => setDoc({ title: '', kind: 'LINK', url: '', menu: '', roles: ['ALL'] })}>Add a document</button> : <button className="btn pri" onClick={() => setFaq({ topic: FAQ_TOPICS[0], q: '', a: '', roles: ['ALL'] })}>Add a question</button>}>
    <Tabs tabs={[['docs', `Documents (${(db.helpDocs || []).length})`], ['faq', `School FAQs (${(db.schoolFaqs || []).length})`]]} value={tab} onChange={setTab} />
    {tab === 'docs' && <div className="tw" style={{ marginTop: 12 }}><table className="t" aria-label="Help documents"><thead><tr><th>Title</th><th>Menu</th><th>Who sees it</th><th>Version</th><th>Added</th><th /></tr></thead>
      <tbody>{(db.helpDocs || []).length ? db.helpDocs.map((d) => <tr key={d.id}><td className="b">{d.title}<div className="small muted">{d.kind === 'FILE' ? d.fileName : d.url}</div></td><td>{LABEL[d.menu] || 'General'}</td><td className="small">{who(d.roles)}</td><td>v{d.version}</td><td className="small">{d.addedBy} · {dmon(d.at)}</td>
        <td><div className="row"><button className="btn sm" onClick={() => setDoc({ ...d })}>Edit</button><button className="btn sm danger" onClick={() => { run((x) => { x.helpDocs = x.helpDocs.filter((y) => y.id !== d.id); }); notify('Removed'); }}>Remove</button></div></td></tr>)
        : <tr><td colSpan={6} className="muted">No documents yet.</td></tr>}</tbody></table></div>}
    {tab === 'faq' && <div className="tw" style={{ marginTop: 12 }}><table className="t" aria-label="School FAQs"><thead><tr><th>Topic</th><th>Question</th><th>Who sees it</th><th /></tr></thead>
      <tbody>{(db.schoolFaqs || []).length ? db.schoolFaqs.map((f) => <tr key={f.id}><td>{f.topic}</td><td><b>{f.q}</b><div className="small">{f.a}</div></td><td className="small">{who(f.roles)}</td>
        <td><div className="row"><button className="btn sm" onClick={() => setFaq({ ...f })}>Edit</button><button className="btn sm danger" onClick={() => { run((x) => { x.schoolFaqs = x.schoolFaqs.filter((y) => y.id !== f.id); }); notify('Removed'); }}>Remove</button></div></td></tr>)
        : <tr><td colSpan={4} className="muted">No school questions yet. The standard FAQs are always there.</td></tr>}</tbody></table>
      <p className="small muted">{FAQS.length} standard questions are built in; these are added on top.</p></div>}
    {doc && <Modal title={doc.id ? 'Edit document' : 'Add a document'} onClose={() => setDoc(null)} actions={<button className="btn pri" onClick={saveDoc}>Save</button>}>
      <Field label="Title" req><Input value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} placeholder="e.g. Staff handbook 2026-27" /></Field>
      <Field label="Document"><div className="row small"><label className="row"><input type="radio" checked={doc.kind === 'LINK'} onChange={() => setDoc({ ...doc, kind: 'LINK' })} />A link</label><label className="row"><input type="radio" checked={doc.kind === 'FILE'} onChange={() => setDoc({ ...doc, kind: 'FILE' })} />Upload a file</label></div></Field>
      {doc.kind === 'LINK' ? <Field label="Link (https://…)" req><Input value={doc.url || ''} onChange={(e) => setDoc({ ...doc, url: e.target.value })} /></Field>
        : <Field label="File (PDF, Word, Excel or image)" req><input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg" onChange={onFile} aria-label="Choose file" />{doc.fileName && <div className="small">{doc.fileName}</div>}</Field>}
      <Field label="Belongs to menu"><Select value={doc.menu} onChange={(e) => setDoc({ ...doc, menu: e.target.value })} options={menus} /></Field>
      <Field label="Who can see it" req>{pickRoles(doc.roles, (roles) => setDoc({ ...doc, roles }))}</Field>
      <p className="small muted">In production files go to the school’s private storage; here they stay in this browser.</p>
    </Modal>}
    {faq && <Modal title={faq.id ? 'Edit question' : 'Add a question'} onClose={() => setFaq(null)} actions={<button className="btn pri" onClick={saveFaq}>Save</button>}>
      <Field label="Topic" req><Input list="faq-topics" value={faq.topic} onChange={(e) => setFaq({ ...faq, topic: e.target.value })} /><datalist id="faq-topics">{FAQ_TOPICS.map((t) => <option key={t} value={t} />)}</datalist></Field>
      <Field label="Question" req><Input value={faq.q} onChange={(e) => setFaq({ ...faq, q: e.target.value })} /></Field>
      <Field label="Answer" req><textarea className="i" style={{ width: '100%', minHeight: 100 }} value={faq.a} onChange={(e) => setFaq({ ...faq, a: e.target.value })} /></Field>
      <Field label="Who can see it" req>{pickRoles(faq.roles, (roles) => setFaq({ ...faq, roles }))}</Field>
    </Modal>}
  </Page>;
}
