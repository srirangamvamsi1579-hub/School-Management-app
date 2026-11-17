import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useStore } from '../data/store.js';
import { Page, Card, Select, Status, Tabs, Field, Input } from '../components/ui.jsx';
import { dmon } from '../lib/format.js';
import { IMPORT_FIELDS, suggestField, mapRows, commitImport, rollbackImport } from '../lib/logic.js';

const TRANSFORMS = [['TRIM', 'As is'], ['UPPER', 'UPPER CASE'], ['TITLE', 'Title Case'], ['FIRST_WORD', 'First word'], ['AFTER_FIRST_WORD', 'After first word'], ['DATE', 'Date'], ['PHONE_IN', 'Indian mobile'], ['NUMBER', 'Number']];
const SAMPLE_CSV = `Adm No,Student Name,D.O.B,Sex,Std,Div,Father Name,Mobile,E-mail
ADM-2019-7701,Riya Kulkarni,14/03/2013,Girl,8th,A,ANIL KULKARNI,+91 98450 11223,anil.k@example.com
ADM-2019-7702,Kabir Shah,02/11/2012,Boy,8th,B,meena shah,9845022334,
ADM-2019-7703,Tara Iyer,31/02/2013,Girl,8th,A,Suresh Iyer,98450 33445,suresh.iyer@example
ADM-2019-7704,Dev Menon,21/07/2012,Boy,8th,C,Rajesh Menon,9845044556,rajesh.m@example.com
ADM-2019-7705,Zoya Khan,09/09/2013,Girl,VIII,B,Imran Khan,9845055667,imran.k@example.com`;

export function DataImport() {
  const { db, run, notify, session } = useStore();
  const [tab, setTab] = useState('new');
  const [entity, setEntity] = useState('STUDENTS');
  const [file, setFile] = useState(null);       // { name, kind, headers, rows, image }
  const [prof, setProf] = useState(null);       // mapping being edited
  const [step, setStep] = useState(1);
  const [grid, setGrid] = useState('');
  const fields = IMPORT_FIELDS[entity];

  const startMapping = (name, kind, rows, image = null) => {
    const headers = Object.keys(rows[0] || {});
    const saved = db.importProfiles.find((p) => p.entity === entity && Object.values(p.columns).every((c) => headers.includes(c)));
    const columns = {}, transforms = {};
    if (saved) Object.assign(columns, saved.columns), Object.assign(transforms, saved.transforms);
    else headers.forEach((h) => { const f = suggestField(entity, h); if (f && !columns[f]) columns[f] = h; });
    fields.forEach(([f, , type]) => { if (!transforms[f]) transforms[f] = type === 'DATE' ? 'DATE' : type === 'PHONE' ? 'PHONE_IN' : 'TRIM'; });
    setFile({ name, kind, headers, rows, image });
    setProf({ name: saved?.name || '', savedFrom: saved?.name, entity, dateFormat: saved?.dateFormat || 'DD/MM/YYYY', columns, transforms, values: structuredClone(saved?.values || { gender: { Boy: 'Male', Girl: 'Female', M: 'Male', F: 'Female' } }) });
    setStep(2);
  };

  const onFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (/\.(jpe?g|png)$/i.test(f.name)) {
      const url = URL.createObjectURL(f);
      setFile({ name: f.name, kind: 'IMAGE', headers: [], rows: [], image: url }); setStep(1.5); return;
    }
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
    if (!rows.length) { notify('No rows found in the first sheet'); return; }
    startMapping(f.name, /csv$/i.test(f.name) ? 'CSV' : 'XLSX', rows);
  };
  const useSample = () => { const wb = XLSX.read(SAMPLE_CSV, { type: 'string', raw: true }); startMapping('old-erp-export.csv', 'CSV', XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })); };
  const fromGrid = () => { const wb = XLSX.read(grid, { type: 'string', raw: true }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true }); if (!rows.length) { notify('Paste a header row and at least one data row'); return; } startMapping(file.name, 'IMAGE', rows, file.image); };

  const mapped = prof && file?.rows.length ? mapRows(db, entity, file.rows, prof) : [];
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
    <Page title="Data import" sub="Bring existing data in from Excel, CSV or a photo of a register. Map the file's columns to the app's fields once, save the mapping, and re-use it.">
      <Tabs tabs={[['new', 'New import'], ['history', `Import history (${db.importJobs.length})`], ['maps', `Saved mappings (${db.importProfiles.length})`]]} value={tab} onChange={setTab} />
      {tab === 'history' && <div className="tw"><table className="t"><thead><tr><th>When</th><th>File</th><th>Data</th><th>Rows</th><th>By</th><th>Status</th><th /></tr></thead>
        <tbody>{db.importJobs.length === 0 ? <tr><td colSpan={7} className="muted">No imports yet.</td></tr> : db.importJobs.map((j) => <tr key={j.id}><td>{dmon(j.at)}</td><td>{j.fileName}</td><td>{j.entity}</td><td>{j.rows}{j.skipped ? ` (${j.skipped} skipped)` : ''}</td><td>{j.by}</td><td><Status s={j.status} /></td>
          <td>{j.status === 'IMPORTED' && <button className="btn sm danger" onClick={() => { run((d) => rollbackImport(d, j.id, session.role)); notify('Import rolled back'); }}>Roll back</button>}</td></tr>)}</tbody></table></div>}
      {tab === 'maps' && <div className="grid g2">{db.importProfiles.map((p) => <Card key={p.id} title={p.name} right={<span className="pill">{p.entity}</span>}>
        <table className="t"><tbody>{Object.entries(p.columns).map(([f, c]) => <tr key={f}><td>{c}</td><td>→</td><td className="b">{f}</td><td className="small muted">{p.transforms[f] && p.transforms[f] !== 'TRIM' ? p.transforms[f] : ''}</td></tr>)}</tbody></table>
        <p className="small muted">Value maps: {Object.entries(p.values).map(([f, m]) => `${f}: ${Object.entries(m).map(([a, b]) => a + '→' + b).join(', ')}`).join(' · ')}</p></Card>)}</div>}

      {tab === 'new' && <>
        <div className="row small" style={{ marginBottom: 12 }}>{['Upload', 'Map columns', 'Check & fix', 'Import'].map((s, i) => <span key={s} className={'pill' + (Math.floor(step) === i + 1 ? ' info' : '')}>{i + 1}. {s}</span>)}</div>

        {step === 1 && <div className="grid g-side">
          <Card title="1. Upload">
            <Field label="What are you importing?"><Select value={entity} onChange={(e) => setEntity(e.target.value)} options={[['STUDENTS', 'Students with guardians'], ['STAFF', 'Staff']]} /></Field>
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
