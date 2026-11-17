import { createElement } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card } from '../components/ui.jsx';
import { LABEL } from '../data/menu.js';
import { Dashboard, Insights } from './Dashboard.jsx';
import { StudentList, StudentProfile, Admission, Attendance, Documents, Promote } from './Students.jsx';
import { StaffList, AddStaff, StaffAttendance, Leave, Classes, Syllabus } from './Staff.jsx';
import { Timetable } from './Timetable.jsx';
import { QuestionPapers, ApprovedPapers, QuestionBank, PaperFormats, CoScholastic, AssessmentProfiles } from './Exams.jsx';
import { CollectFee, FeeRequests, PaymentMatching, Dues, Receipts, FeeStructure, Concessions, ParentFees } from './Fees.jsx';
import { RunPayroll, Payslips, BankDetails, AccountStatement, Expenses } from './Accounts.jsx';
import { DataImport } from './Import.jsx';
import { Admissions } from './Admissions.jsx';
import { ReportCatalogue, TopBottom, TransportReports, TeacherPerformance, AdmissionsFunnel } from './Analytics.jsx';
import { Users, Roles, Templates, Appearance, WebsiteLinks, Outbox, Platform, MyPrefs } from './Operations.jsx';

function MyChild() {
  const { db } = useStore();
  const kid = db.students.find((s) => s.admNo === 'ADM-2025-0231');
  return createElement(Page, { title: 'My child' }, createElement(StudentProfile, { s: kid }));
}
const MySlips = () => createElement(Payslips, { self: true });

export function Placeholder({ code }) {
  return createElement(Page, { title: LABEL[code] || 'Coming soon' }, createElement(Card, null, 'This screen is designed (see the design canvas) but not part of the test build yet.'));
}

export const SCREENS = {
  DASH: Dashboard, STU_INS: Insights, STF_INS: Insights, FEE_INS: Insights,
  STU_LIST: StudentList, STU_ADMISSIONS: Admissions,
  ANL_HOME: ReportCatalogue, ANL_RANK: TopBottom, ANL_TRANSPORT: TransportReports, ANL_TEACHER: TeacherPerformance, ANL_ADMISSIONS: AdmissionsFunnel, STU_ADMIT: Admission, STU_ATT: Attendance, STU_PROMOTE: Promote, STU_DOCS: Documents,
  STF_LIST: StaffList, STF_ADD: AddStaff, STF_ATT: StaffAttendance, STF_LEAVE: Leave,
  ACA_CLASS: Classes, ACA_SYLLABUS: Syllabus, ACA_TIMETABLE: Timetable,
  EXM_QP: QuestionPapers, EXM_APPROVED: ApprovedPapers, EXM_QB: QuestionBank, EXM_FORMATS: PaperFormats, EXM_COSCH: CoScholastic, EXM_PROFILE: AssessmentProfiles,
  FEE_COLLECT: CollectFee, FEE_REQUESTS: FeeRequests, FEE_MATCHING: PaymentMatching, FEE_DUES: Dues, FEE_RECEIPTS: Receipts, FEE_STRUCT: FeeStructure, FEE_CONC: Concessions,
  PAY_RUN: RunPayroll, PAY_SLIPS: Payslips, ACC_BANK: BankDetails, ACC_STMT: AccountStatement, ACC_EXP: Expenses,
  OPS_USERS: Users, OPS_ROLES: Roles, OPS_TEMPLATES: Templates, OPS_IMPORT: DataImport, OPS_APPEARANCE: Appearance, OPS_WEBSITE: WebsiteLinks, OPS_OUTBOX: Outbox,
  SELF_CHILD: MyChild, SELF_FEES: ParentFees, SELF_PAYSLIP: MySlips, SELF_PREFS: MyPrefs, PLT_SCHOOLS: Platform
};
