import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useStore } from '../data/store.js';
import { Page, Card, Select, Status, Tabs, Field, Input } from '../components/ui.jsx';
import { dmon } from '../lib/format.js';
import { IMPORT_FIELDS, suggestField, mapRows, commitImport, rollbackImport, tenantOf } from '../lib/logic.js';
import { TEMPLATES, templateFile, uploadFile, templateForFile, checkTemplate, loadTemplate, recordChecked, LOADERS, LOAD_ORDER_NOTE, pad } from '../lib/importTemplates.js';
import { todayISO } from '../lib/format.js';
import { Modal } from '../components/ui.jsx';

// A blank template workbook: the Data sheet (headings only) and a How to fill sheet (one row per column)
function templateBook(list) {
  const wb = XLSX.utils.book_new();
  if (list.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No', 'File name', 'Menu', 'What it holds', 'Load order'], ...list.map((t) => [pad(t.no), templateFile(t), t.menu, t.desc, t.no]), [], [LOAD_ORDER_NOTE]]), 'Index');
  list.forEach((t) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.cols.map((c) => c[0])]), list.length > 1 ? `${pad(t.no)} ${t.name}`.slice(0, 31) : 'Data');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Column', 'Required', 'Format', 'Example', 'Notes'], ...t.cols.map(([c, r, f, ex, n]) => [c, r ? 'Yes' : 'No', f.startsWith('ENUM:') ? 'One of: ' + f.slice(5).split('|').join(', ') : f, ex || '', n || ''])]), list.length > 1 ? `${pad(t.no)} how to fill`.slice(0, 31) : 'How to fill');
  });
  return wb;
}

const TRANSFORMS = [['TRIM', 'As is'], ['UPPER', 'UPPER CASE'], ['TITLE', 'Title Case'], ['FIRST_WORD', 'First word'], ['AFTER_FIRST_WORD', 'After first word'], ['DATE', 'Date'], ['PHONE_IN', 'Indian mobile'], ['NUMBER', 'Number']];
const SAMPLE_CSV = `Adm No,Student Name,D.O.B,Sex,Std,Div,Father Name,Mobile,E-mail
ADM-2019-7701,Riya Kulkarni,14/03/2013,Girl,8th,A,ANIL KULKARNI,+91 98450 11223,anil.k@example.com
ADM-2019-7702,Kabir Shah,02/11/2012,Boy,8th,B,meena shah,9845022334,
ADM-2019-7703,Tara Iyer,31/02/2013,Girl,8th,A,Suresh Iyer,98450 33445,suresh.iyer@example
ADM-2019-7704,Dev Menon,21/07/2012,Boy,8th,C,Rajesh Menon,9845044556,rajesh.m@example.com
ADM-2019-7705,Zoya Khan,09/09/2013,Girl,VIII,B,Imran Khan,9845055667,imran.k@example.com`;

export function DataImport() {
  const { db, run, notify, session } = useStore();
  const [tab, setTab] = useState('templates');
  const [entity, setEntity] = useState('STUDENTS');
  const [file, setFile] = useState(null);       // { name, kind, headers, rows, image }
  const [prof, setProf] = useState(null);       // mapping being edited
  const [step, setStep] = useState(1);
  const [grid, setGrid] = useState('');
  const [tpl, setTpl] = useState(null);          // conversion template recognised from the file name or chosen
  const [checked, setChecked] = useState(null);  // { t, name, rows, result }
  const [cols, setCols] = useState(null);
  const fields = IMPORT_FIELDS[entity] || [];
  const school = tenantOf(db)?.code || 'SCHOOL';
  const download = (list, name) => { try { XLSX.writeFile(templateBook(list), name); notify(`Downloaded ${name}`); } catch (e) { notify('Downloads are off in this preview — use the hosted site'); } };

  const startMappingEnt = (ent, name, kind, rows, image = null) => {
    const flds = IMPORT_FIELDS[ent];
    const headers = Object.keys(rows[0] || {});
    const saved = db.importProfiles.find((p) => p.entity === ent && Object.values(p.columns).every((c) => headers.includes(c)));
    const columns = {}, transforms = {};
    if (saved) Object.assign(columns, saved.columns), Object.assign(transforms, saved.transforms);
    else headers.forEach((h) => { const f = suggestField(ent, h); if (f && !columns[f]) columns[f] = h; });
    flds.forEach(([f, , type]) => { if (!transforms[f]) transforms[f] = type === 'DATE' ? 'DATE' : type === 'PHONE' ? 'PHONE_IN' : 'TRIM'; });
    setFile({ name, kind, headers, rows, image });
    setProf({ name: saved?.name || '', savedFrom: saved?.name, entity: ent, dateFormat: saved?.dateFormat || 'DD/MM/YYYY', columns, transforms, values: structuredClone(saved?.values || { gender: { Boy: 'Male', Girl: 'Female', M: 'Male', F: 'Female' } }) });
    setStep(2);
  };
  const startMapping = (name, kind, rows, image = null) => startMappingEnt(entity, name, kind, rows, image);

  const onFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (/\.(jpe?g|png)$/i.test(f.name)) {
      const url = URL.createObjectURL(f);
      setFile({ name: f.name, kind: 'IMAGE', headers: [], rows: [], image: url }); setStep(1.5); return;
    }
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false });
    const sheet = wb.SheetNames.includes('Data') ? 'Data' : wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '', raw: false });
    if (!rows.length) { notify('No rows found in the first sheet'); return; }
    const t = templateForFile(f.name) || (entity.startsWith('T:') ? TEMPLATES.find((x) => x.name === entity.slice(2)) : null);
    e.target.value = '';
    openFile(f.name, /csv$/i.test(f.name) ? 'CSV' : 'XLSX', rows, t);
  };
  // A recognised template: students and staff go through column mapping; the others are checked row by row
  const openFile = (name, kind, rows, t) => {
    if (t && (t.entity === 'STUDENTS' || t.entity === 'STAFF')) { setEntity(t.entity); setTpl(t); startMappingFor(t.entity, name, kind, rows); return; }
    if (t) { setTpl(t); setChecked({ t, name, rows, result: checkTemplate(t, rows) }); setStep(2); return; }
    if (entity.startsWith('T:')) { notify('Choose Students or Staff for a file that is not one of the templates'); return; }
    startMapping(name, kind, rows);
  };
  const startMappingFor = (ent, name, kind, rows) => { setTimeout(() => startMappingEnt(ent, name, kind, rows), 0); };
  const useSample = () => { const wb = XLSX.read(SAMPLE_CSV, { type: 'string', raw: true }); startMapping('old-erp-export.csv', 'CSV', XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })); };
  const fromGrid = () => { const wb = XLSX.read(grid, { type: 'string', raw: true }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true }); if (!rows.length) { notify('Paste a header row and at least one data row'); return; } startMapping(file.name, 'IMAGE', rows, file.image); };

  const mapped = prof && file?.rows.length && IMPORT_FIELDS[entity] ? mapRows(db, entity, file.rows, prof) : [];
  const errs = mapped.filter((r) => r.status === 'ERROR').length, warns = mapped.filter((r) => r.status === 'WARNING').length;
  const unknown = {};
  mapped.forEach((r) => r.msgs.forEach(([, m]) => { const x = m.match(/^(Gender|Class) "(.+?)" not/); if (x) (unknown[x[1] === 'Gender' ? 'gender' : 'class'] ||= new Set()).add(x[2]); }));
  const setCol = (f, h) => setProf({ ...prof, columns: { ...prof.columns, [f]: h || undefined } });
  const setVal = (field, from, to) => setProf({ ...prof, values: { ...prof.values, [field]: { ...(prof.values[field] || {}), [from]: to } } });

  const commit = () => {
    const job = run((d) => {
      if (prof.name && !d.importProfiles.some((p) => p.name === prof.name)) d.importProfiles.push({ ...prof, id: 'M' + (d.importProfiles.length + 1) });
      const job = commitImport(d, entity, mapped.filter((r) => r.status !== 'ERROR'), file.name, session.role); job.skipped = errs; return job;
    });
    notify(`Imported ${job.rows} ${entity.toLowerCase()} — can be rolled back`); setStep(1); setFile(null); setTab('history');
  };

  return (
    <Page title="Data import" sub="Move the school's existing data in with the conversion templates (one per menu, with a fixed naming convention), or from any Excel, CSV or photo of a register for students and staff.">
      <Tabs tabs={[['templates', `Templates (${TEMPLATES.length})`], ['new', 'New import'], ['history', `Import history (${db.importJobs.length})`], ['maps', `Saved mappings (${db.importProfiles.length})`]]} value={tab} onChange={setTab} />
      {tab === 'templates' && <div style={{ marginTop: 12 }}>
        <Card title="Conversion templates" right={<button className="btn pri" onClick={() => download(TEMPLATES, `00_All_Templates_${school}.xlsx`)}>Download all (one workbook)</button>}>
          <p className="small" style={{ marginTop: 0 }}>One template per menu, with every column the app needs, so the school's existing data can be loaded when it moves to the app. Each template has a <b>Data</b> sheet (the headings) and a <b>How to fill</b> sheet (required columns, format and an example).</p>
          <div className="note small"><b>Naming convention.</b> Blank template: <span className="kbd">NN_Name_Data.xlsx</span> (e.g. <span className="kbd">02_Student_Data.xlsx</span>). Filled-in file to upload: <span className="kbd">NN_Name_Data_{school}_YYYYMMDD.xlsx</span> (e.g. <span className="kbd">{uploadFile(TEMPLATES[1], school, todayISO())}</span>). The app recognises the template from the file name. {LOAD_ORDER_NOTE}</div>
          <div className="tw" style={{ marginTop: 10 }}><table className="t" aria-label="Conversion templates"><thead><tr><th>No</th><th>Template file</th><th>Menu</th><th>What it holds</th><th className="num">Columns</th><th>Loads into the app</th><th /></tr></thead>
            <tbody>{TEMPLATES.map((t) => <tr key={t.no}><td>{pad(t.no)}</td><td className="b">{templateFile(t)}</td><td className="small">{t.menu}</td><td className="small">{t.desc}</td><td className="num">{t.cols.filter((c) => c[1]).length} required / {t.cols.length}</td>
              <td className="small">{t.entity === 'STUDENTS' || t.entity === 'STAFF' ? 'Yes, with column mapping and roll back' : LOADERS[t.name] ? 'Yes, checked then loaded; can be rolled back' : 'Checked here; loaded at go-live by the conversion team'}</td>
              <td><div className="row"><button className="btn sm" onClick={() => setCols(t)}>Columns</button><button className="btn sm" onClick={() => download([t], templateFile(t))}>Download</button></div></td></tr>)}</tbody></table></div>
        </Card>
      </div>}
      {cols && <Modal title={`${templateFile(cols)} — columns`} onClose={() => setCols(null)}><p className="small">{cols.desc} Menu: {cols.menu}.</p>
        <table className="t small"><thead><tr><th>Column</th><th>Required</th><th>Format</th><th>Example</th><th>Notes</th></tr></thead>
          <tbody>{cols.cols.map(([c, r, f, ex, n]) => <tr key={c}><td className="b">{c}</td><td>{r ? 'Yes' : ''}</td><td>{f.startsWith('ENUM:') ? f.slice(5).split('|').join(' / ') : f}</td><td>{ex}</td><td>{n}</td></tr>)}</tbody></table></Modal>}
      {tab === 'history' && <div className="tw"><table className="t"><thead><tr><th>When</th><th>File</th><th>Data</th><th>Rows</th><th>By</th><th>Status</th><th /></tr></thead>
        <tbody>{db.importJobs.length === 0 ? <tr><td colSpan={7} className="muted">No imports yet.</td></tr> : db.importJobs.map((j) => <tr key={j.id}><td>{dmon(j.at)}</td><td>{j.fileName}</td><td>{j.entity}</td><td>{j.rows}{j.skipped ? ` (${j.skipped} skipped)` : ''}</td><td>{j.by}</td><td><Status s={j.status} /></td>
          <td>{j.status === 'IMPORTED' && (j.created.length > 0 || j.undo?.length > 0) && <button className="btn sm danger" onClick={() => { run((d) => rollbackImport(d, j.id, session.role)); notify('Import rolled back'); }}>Roll back</button>}</td></tr>)}</tbody></table></div>}
      {tab === 'maps' && <div className="grid g2">{db.importProfiles.map((p) => <Card key={p.id} title={p.name} right={<span className="pill">{p.entity}</span>}>
        <table className="t"><tbody>{Object.entries(p.columns).map(([f, c]) => <tr key={f}><td>{c}</td><td>→</td><td className="b">{f}</td><td className="small muted">{p.transforms[f] && p.transforms[f] !== 'TRIM' ? p.transforms[f] : ''}</td></tr>)}</tbody></table>
        <p className="small muted">Value maps: {Object.entries(p.values).map(([f, m]) => `${f}: ${Object.entries(m).map(([a, b]) => a + '→' + b).join(', ')}`).join(' · ')}</p></Card>)}</div>}

      {tab === 'new' && <>
        <div className="row small" style={{ marginBottom: 12 }}>{['Upload', 'Map columns', 'Check & fix', 'Import'].map((s, i) => <span key={s} className={'pill' + (Math.floor(step) === i + 1 ? ' info' : '')}>{i + 1}. {s}</span>)}</div>

        {step === 1 && <div className="grid g-side">
          <Card title="1. Upload">
            <Field label="What are you importing?"><Select value={entity} onChange={(e) => setEntity(e.target.value)} options={[['STUDENTS', 'Students with guardians (any file)'], ['STAFF', 'Staff (any file)'], ...TEMPLATES.filter((t) => t.entity !== 'STUDENTS' && t.entity !== 'STAFF').map((t) => ['T:' + t.name, `${pad(t.no)} ${t.name.replace(/_/g, ' ')} (template)`])]} /></Field>
            <p className="small muted">A file named after a template (e.g. {uploadFile(TEMPLATES[10], school, todayISO())}) is recognised whatever is chosen here.</p>
            <div className="drop" style={{ marginTop: 12 }}>
              <p className="b">Excel (.xlsx), CSV, or a photo of a register (.jpg / .png)</p>
              <input type="file" accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png" onChange={onFile} aria-label="Choose file" />
              <p className="small muted">The file is read in your browser only. In production it's stored in the school's private S3 folder.</p>
            </div>
            {entity === 'STUDENTS' && <p style={{ marginTop: 12 }}>No file handy? <button className="btn sm" onClick={useSample}>Use a sample old-ERP export</button> <span className="small muted">(5 rows with typical problems)</span></p>}
          </Card>
          <Card title="Fields the app needs">
            <table className="t"><tbody>{fields.map(([f, label, type, req]) => <tr key={f}><td className={req ? 'b' : ''}>{label}{req ? ' *' : ''}</td><td className="small muted">{type.startsWith('ENUM') ? type.slice(5) : type}</td></tr>)}</tbody></table>
            <p className="small muted">Headings in your file don't need to match — the app suggests a match (“Adm No” → Admission no., “Father Name” → Guardian name).</p>
          </Card>
        </div>}

        {step === 1.5 && <div className="grid g2">
          <Card title={'Photo: ' + file.name}><img src={file.image} alt="Uploaded register" style={{ width: '100%', borderRadius: 8 }} /></Card>
          <Card title="Read the photo">
            <div className="note small" style={{ marginBottom: 10 }}>In production the photo goes to Amazon Textract, which reads the table and fills the grid below with a confidence score per cell; low-confidence cells are highlighted for checking. In this test build, type or paste the rows (comma-separated, first line = headings).</div>
            <textarea className="i" style={{ width: '100%', minHeight: 200 }} value={grid} onChange={(e) => setGrid(e.target.value)} placeholder={'Adm No,Student Name,D.O.B,Sex,Std,Div,Father Name,Mobile\nADM-2019-7801,…'} />
            <div className="row end" style={{ marginTop: 10 }}><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn pri" onClick={fromGrid}>Continue to mapping</button></div>
          </Card>
        </div>}

        {step >= 2 && checked && <Card title={`Checked against ${templateFile(checked.t)} — ${checked.name} (${checked.rows.length} rows)`} right={<span className="row"><Status s={`${checked.result.ok} OK`} /><Status s="ERROR" />{checked.rows.length - checked.result.ok}</span>}>
          {checked.result.missing.length > 0 && <div className="note" style={{ marginBottom: 8 }}><b>Missing required columns:</b> {checked.result.missing.join(', ')}. Use the template headings.</div>}
          {checked.result.extra.length > 0 && <p className="small muted">Columns not in the template (ignored): {checked.result.extra.join(', ')}</p>}
          <div className="tw" style={{ maxHeight: 320 }}><table className="t small"><thead><tr><th>Row</th><th>Status</th><th>Messages</th></tr></thead>
            <tbody>{checked.result.rows.filter((r) => r.status !== 'OK').slice(0, 200).map((r) => <tr key={r.rowNo}><td>{r.rowNo}</td><td><Status s={r.status} /></td><td>{r.msgs.join('; ')}</td></tr>)}
              {checked.result.rows.every((r) => r.status === 'OK') && <tr><td colSpan={3} className="muted">Every row matches the template.</td></tr>}</tbody></table></div>
          <div className="row end" style={{ marginTop: 10 }}><button className="btn" onClick={() => { setStep(1); setChecked(null); setTpl(null); }}>Start over</button>
            <button className="btn pri" disabled={checked.result.missing.length > 0 || !checked.result.ok} onClick={() => {
              const good = checked.rows.filter((_, i) => checked.result.rows[i].status === 'OK');
              if (LOADERS[checked.t.name]) { const { job, errors } = run((d) => loadTemplate(d, checked.t, good, checked.name, session.role)); notify(`Loaded ${job.rows} rows${errors.length ? ` · ${errors.length} skipped (${errors[0].msg})` : ''} — can be rolled back`); }
              else { run((d) => recordChecked(d, checked.t, checked.name, session.role, checked.result.ok, checked.rows.length - checked.result.ok)); notify(`${checked.result.ok} rows checked and ready — the conversion team loads this file at go-live`); }
              setStep(1); setChecked(null); setTpl(null); setTab('history'); }}>{LOADERS[checked.t.name] ? `Load ${checked.result.ok} rows` : `Mark ${checked.result.ok} rows ready to load`}</button></div>
        </Card>}

        {step >= 2 && prof && <>
          <Card title={`2. Map columns — ${file.name} (${file.rows.length} rows)`} right={prof.savedFrom && <span className="pill ok">Using saved mapping “{prof.savedFrom}”</span>}>
            <div className="tw"><table className="t"><thead><tr><th>App field</th><th>Column in your file</th><th>Change</th><th>First row becomes</th></tr></thead>
              <tbody>{fields.map(([f, label, type, req]) => <tr key={f}>
                <td className={req ? 'b' : ''}>{label}{req ? ' *' : ''}</td>
                <td><select className="i" value={prof.columns[f] || ''} onChange={(e) => setCol(f, e.target.value)}><option value="">— not in file —</option>{file.headers.map((h) => <option key={h}>{h}</option>)}</select></td>
                <td><select className="i" value={prof.transforms[f]} onChange={(e) => setProf({ ...prof, transforms: { ...prof.transforms, [f]: e.target.value } })}>{TRANSFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td className="small">{mapped[0]?.out[f] ?? ''}</td></tr>)}</tbody></table></div>
            <div className="row" style={{ marginTop: 10 }}>
              <Field label="Dates in the file are"><Select value={prof.dateFormat} onChange={(e) => setProf({ ...prof, dateFormat: e.target.value })} options={['DD/MM/YYYY', 'MM/DD/YYYY']} /></Field>
              <Field label="Save this mapping as (optional)"><Input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} placeholder="e.g. Old ERP export" /></Field>
            </div>
          </Card>

          {Object.keys(unknown).length > 0 && <Card title="Values the app doesn't recognise">
            <p className="small muted">Tell the app what these mean once; it remembers for this mapping.</p>
            {Object.entries(unknown).map(([field, set]) => [...set].map((v) => <div key={field + v} className="row" style={{ marginBottom: 6 }}>
              <span className="pill warn">{field}: “{v}”</span> means
              <select className="i" defaultValue="" onChange={(e) => setVal(field, v, e.target.value)}><option value="" disabled>choose…</option>
                {(field === 'gender' ? ['Male', 'Female', 'Other'] : db.classes.map((c) => c.name)).map((o) => <option key={o}>{o}</option>)}</select></div>))}
          </Card>}

          <Card title="3. Check & fix" right={<span className="row"><Status s={`${mapped.length - errs - warns} OK`} /><Status s="WARNING" />{warns}<Status s="ERROR" />{errs}</span>}>
            <div className="tw" style={{ maxHeight: 360 }}><table className="t"><thead><tr><th>Row</th><th>Status</th>{fields.slice(0, 7).map(([f, l]) => <th key={f}>{l}</th>)}<th>Messages</th></tr></thead>
              <tbody>{mapped.map((r) => <tr key={r.rowNo}><td>{r.rowNo}</td><td><Status s={r.status} /></td>{fields.slice(0, 7).map(([f]) => <td key={f}>{r.out[f]}</td>)}<td className="small">{r.msgs.map((m, i) => <div key={i} style={{ color: m[0] === 'error' ? 'var(--bad)' : 'var(--warn)' }}>{m[1]}</div>)}</td></tr>)}</tbody></table></div>
            <p className="small muted" style={{ marginTop: 8 }}>Fix errors with a value mapping above, or correct the file and upload again; rows still in error are skipped. Warnings import with the field left blank.</p>
          </Card>

          <div className="row end"><button className="btn" onClick={() => { setStep(1); setFile(null); }}>Start over</button>
            {errs > 0 && <span className="small muted">{errs} row(s) with errors will be skipped</span>}
            <button className="btn pri" disabled={mapped.length - errs === 0} onClick={commit}>4. Import {mapped.length - errs} rows</button></div>
        </>}
      </>}
    </Page>
  );
}
