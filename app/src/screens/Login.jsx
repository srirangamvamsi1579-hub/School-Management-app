import { useStore } from '../data/store.js';
import { ROLES, PLANS } from '../data/menu.js';
import { Select } from '../components/ui.jsx';

const WHAT = {
  ADMIN: 'Everything for the school: setup, users, templates, data import, branding',
  PRINCIPAL: 'Insights, approvals, papers, fee follow-up',
  ACCOUNTANT: 'Fees, fee emails, payment matching, payroll, bank details, statements',
  TEACHER: 'Attendance, timetable, question papers, co-scholastic grades, profiles',
  FRONT_OFFICE: 'Admissions, documents, fee counter',
  PARENT: 'Child profile, timetable, fee dues and pay',
  PLATFORM: 'Your company: schools, plans, add-ons, switching modules on/off'
};

export default function Login() {
  const { db, mutate, login } = useStore();
  return (
    <div className="login">
      <div className="box">
        <h1>School Management Platform</h1>
        <p className="muted">User-testing build. Data lives in this browser only — nothing is sent anywhere. Pick a school and sign in as any role to see the menus that role gets.</p>
        <div className="row" style={{ margin: '14px 0' }}>
          <label className="f" style={{ minWidth: 320 }}>School (plan decides which menus are switched on)
            <Select value={db.tenantId} onChange={(e) => mutate((d) => { d.tenantId = e.target.value; })}
              options={db.tenants.map((t) => [t.id, `${t.name} — ${PLANS.find((p) => p.code === t.plan).name}`])} />
          </label>
        </div>
        <div className="rolegrid">
          {ROLES.map((r) => (
            <button key={r.code} onClick={() => login({ role: r.code })}>
              <div className="b">{r.name}</div>
              <div className="small muted">{r.user}</div>
              <div className="small" style={{ marginTop: 6 }}>{WHAT[r.code]}</div>
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>In production each person signs in with their own email/mobile and OTP (Amazon Cognito); the role and school come from their account.</p>
      </div>
    </div>
  );
}
