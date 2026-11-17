import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Select, Modal, Input, Field, printPage } from '../components/ui.jsx';
import { log } from '../lib/logic.js';

// Period layout of the school's Grade IX Friday sheet: section periods, grade-wide blocks and lunch
const LAYOUT = ['S0', 'S1', 'S2', 'ELECTIVE', 'p5', 'p6', 'LUNCH', 'S3', 'p9', 'p10', 'SELF', 'p12'];
const teachersIn = (cell = '') => (cell.split(' ').slice(1).join(' ') || '').split('/').map((x) => x.trim()).filter(Boolean);

export function Timetable() {
  const { db, run, notify, session } = useStore();
  const [day, setDay] = useState('FRI');
  const [edit, setEdit] = useState(null);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const tt = db.timetable.C9;
  const fri = tt.FRI, blocks = tt.blocks.FRI;
  const secs = Object.keys(fri);
  const canEdit = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  const mine = session.role === 'TEACHER' ? 'SON' : null;

  const cell = (sec, k) => {
    const L = LAYOUT[k];
    if (L.startsWith('S')) return fri[sec][Number(L[1])];
    return null;
  };
  const save = () => {
    const { sec, k } = edit;
    const idx = Number(LAYOUT[k][1]);
    const clash = secs.filter((s) => s !== sec).find((s) => teachersIn(fri[s][idx]).some((t) => teachersIn(val).includes(t)));
    if (clash) { setErr(`Clash: ${teachersIn(val).join('/')} already teaches ${clash} in this period`); return; }
    run((d) => { d.timetable.C9.FRI[sec][idx] = val; log(d, session.role, 'Timetable changed', `IX-${sec} period ${k + 1} → ${val}`); });
    notify('Timetable updated'); setEdit(null);
  };

  return (
    <Page title="Timetable" sub="Grade IX — built from the school's own daily sheet. Grade-wide blocks (electives, PT, assemblies) span all sections."
      actions={<><Select aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)} options={[['MON', 'Monday'], ['TUE', 'Tuesday'], ['WED', 'Wednesday'], ['THU', 'Thursday'], ['FRI', 'Friday']]} /><button className="btn" onClick={() => printPage()}>Print</button></>}>
      {day !== 'FRI' && <div className="note" style={{ marginBottom: 12 }}>Only Friday is filled in for the test. Other days are entered the same way.</div>}
      {mine && <div className="note" style={{ marginBottom: 12 }}>Your periods (SON) are highlighted.</div>}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table className="tt">
            <thead><tr><th>Section</th>{db.periods.map((p, k) => <th key={k}>{k + 1}<div className="small muted">{p}</div></th>)}</tr></thead>
            <tbody>
              {secs.map((sec, r) => (
                <tr key={sec}>
                  <th>IX-{sec}</th>
                  {LAYOUT.map((L, k) => {
                    if (day !== 'FRI') return <td key={k} className="muted">—</td>;
                    if (L === 'LUNCH') return r === 0 ? <td key={k} rowSpan={secs.length} className="blk">Lunch</td> : null;
                    if (L === 'SELF') return r === 0 ? <td key={k} rowSpan={secs.length} className="blk">Self study</td> : null;
                    if (!L.startsWith('S')) { const txt = blocks[L === 'ELECTIVE' ? 'p4' : L]; return r === 0 ? <td key={k} rowSpan={secs.length} className="blk">{txt}</td> : null; }
                    const v = cell(sec, k);
                    const hl = mine && teachersIn(v).includes(mine);
                    return <td key={k} style={{ cursor: canEdit ? 'pointer' : 'default', background: hl ? 'var(--warn-bg)' : undefined, fontWeight: hl ? 700 : 400 }}
                      onClick={() => canEdit && (setEdit({ sec, k }), setVal(v), setErr(''))}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Cells read “SUBJECT TEACHER”. Two teachers are written “SON/SH”. {canEdit ? 'Click a section period to change it — the app blocks a teacher being in two sections at once.' : ''}</p>
      </Card>
      {edit && <Modal title={`IX-${edit.sec} · period ${edit.k + 1} (${db.periods[edit.k]})`} onClose={() => setEdit(null)} actions={<button className="btn pri" onClick={save}>Save</button>}>
        <Field label="Subject and teacher short code(s)"><Input value={val} onChange={(e) => { setVal(e.target.value); setErr(''); }} /></Field>
        <p className="small muted">Teachers: {db.staff.filter((s) => s.desig.includes('GT')).map((s) => s.short).join(', ')}</p>
        {err && <div className="note warn">{err}</div>}
      </Modal>}
    </Page>
  );
}
