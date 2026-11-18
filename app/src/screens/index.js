import { createElement } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card } from '../components/ui.jsx';
import { LABEL } from '../data/menu.js';
import { Dashboard, Insights } from './Dashboard.jsx';
import { StudentList, StudentProfile, StudentProfiles, Admission, Attendance, Documents, ReportCards, ChildReportCards } from './Students.jsx';
import { StaffList, StaffAttendance, Leave, MyLeave, Classes, Syllabus } from './Staff.jsx';
import { Timetable } from './Timetable.jsx';
import { CoScholastic, AssessmentProfiles } from './Exams.jsx';
import { QuestionPapers, ApprovedPapers, QuestionBank, Blueprints } from './Papers.jsx';
import { CollectFee, FeeRequests, PaymentMatching, Dues, Receipts, FeeStructure, Concessions, ParentFees } from './Fees.jsx';
import { RunPayroll, Payslips, BankDetails, AccountStatement, Expenses } from './Accounts.jsx';
import { DataImport } from './Import.jsx';
import ChannelScreens from './Channels.jsx';
import MainMenu from './Home.jsx';
import HelpGuide from './Guide.jsx';
import { Faqs, HelpDocs } from './Help.jsx';
import { ParentRequests, CoordinatorDesk, GateDesk, ClassCoordinators, ParentMeetings, OfficeRequests, myChildren } from './Requests.jsx';
import { BusManifest, TransportChanges, RoutesRiders, DriverRouteSheets } from './Transport.jsx';
import { MyAccount, SmsGateway, MyPerformance } from './Account.jsx';
import { Admissions } from './Admissions.jsx';
import { ReportCatalogue, TopBottom, TransportReports, TeacherPerformance, AdmissionsFunnel } from './Analytics.jsx';
import { Users, Roles, Templates, Appearance, WebsiteLinks, Outbox, Platform, MyPrefs } from './Operations.jsx';

function MyChild() {
  const { db } = useStore();
  const { session } = useStore();
  const kids = myChildren(db, session);
  return createElement(Page, { title: kids.length > 1 ? 'My children' : 'My child' }, ...kids.flatMap((kid) => [createElement(ChildReportCards, { s: kid, key: 'rc' + kid.id }), createElement(Card, { key: kid.id }, createElement(StudentProfile, { s: kid }))]));
}
const MySlips = () => createElement(Payslips, { self: true });

export function Placeholder({ code }) {
  return createElement(Page, { title: LABEL[code] || 'Coming soon' }, createElement(Card, null, 'This screen is designed (see the design canvas) but not part of the test build yet.'));
}

export const SCREENS = {
  DASH: Dashboard, STU_INS: Insights, STF_INS: Insights, FEE_INS: Insights,
  STU_LIST: StudentList, STU_REQUESTS: CoordinatorDesk, HOME: MainMenu, VA_PARENT: MainMenu, VA_TEACHER: MainMenu, VA_VP: MainMenu, VA_HOTS: MainMenu, VA_PRINCIPAL: MainMenu, VA_ACCOUNTANT: MainMenu, VA_FRONT_OFFICE: MainMenu, VA_TRANSPORT: MainMenu, OPS_CHANNELS: ChannelScreens, HELP_GUIDE: HelpGuide, STU_MEETINGS: ParentMeetings, STU_OFFICE: OfficeRequests, STU_GATE: GateDesk, ACA_COORD: ClassCoordinators,
  TRN_MANIFEST: BusManifest, TRN_SHEETS: DriverRouteSheets, TRN_CHANGES: TransportChanges, TRN_ROUTES: RoutesRiders, OPS_SMS: SmsGateway,
  SELF_REQUESTS: ParentRequests, SELF_PROFILE: MyAccount, SELF_MYPERF: MyPerformance, STU_ADMISSIONS: Admissions,
  ANL_HOME: ReportCatalogue, ANL_RANK: TopBottom, ANL_TRANSPORT: TransportReports, ANL_TEACHER: TeacherPerformance, ANL_ADMISSIONS: AdmissionsFunnel, STU_ADMIT: Admission, STU_ATT: Attendance, STU_REPORTCARD: ReportCards, STU_PROFILE: StudentProfiles, STU_DOCS: Documents,
  STF_LIST: StaffList, STF_ATT: StaffAttendance, STF_LEAVE: Leave, SELF_LEAVE: MyLeave,
  ACA_CLASS: Classes, ACA_SYLLABUS: Syllabus, ACA_TIMETABLE: Timetable,
  EXM_QP: QuestionPapers, EXM_APPROVED: ApprovedPapers, EXM_QB: QuestionBank, EXM_FORMATS: Blueprints, EXM_COSCH: CoScholastic, EXM_PROFILE: AssessmentProfiles,
  FEE_COLLECT: CollectFee, FEE_REQUESTS: FeeRequests, FEE_MATCHING: PaymentMatching, FEE_DUES: Dues, FEE_RECEIPTS: Receipts, FEE_STRUCT: FeeStructure, FEE_CONC: Concessions,
  PAY_RUN: RunPayroll, PAY_SLIPS: Payslips, ACC_BANK: BankDetails, ACC_STMT: AccountStatement, ACC_EXP: Expenses,
  OPS_USERS: Users, OPS_ROLES: Roles, OPS_TEMPLATES: Templates, OPS_IMPORT: DataImport, OPS_APPEARANCE: Appearance, OPS_WEBSITE: WebsiteLinks, OPS_OUTBOX: Outbox,
  HELP_FAQ: Faqs, OPS_HELPDOCS: HelpDocs, SELF_CHILD: MyChild, SELF_FEES: ParentFees, SELF_PAYSLIP: MySlips, SELF_PREFS: MyPrefs, PLT_SCHOOLS: Platform
};
