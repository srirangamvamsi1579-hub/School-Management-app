// User guide content: what every screen is for, how to use it, and guided end-to-end demos.
// One source for the in-app guide (Help → User Guide & Demo) and docs/USER_GUIDE.md (scripts/user-guide.mjs).

// Demo accounts (password for all: Demo@123)
export const DEMO_PEOPLE = {
  U1: 'Admin user (Admin)', U2: 'Dr. Kavita Menon (Principal)', U3: 'Sana Khan (Accountant)', U4: 'Sonia Mehta (Teacher, class coordinator 8-A)',
  U5: 'Anita Rao (Front Office)', U6: 'Rohit Sharma (Parent of Aarav, 8-A)', U7: 'Meera Iyer (Teacher + Vice Principal)', U8: 'Platform support (our company)',
  U20: 'Manjunath Gowda (Transport In-charge)', U21: 'Murali Krishnan (Teacher + Head of Teaching Staff)'
};

// [what it is for, how to use it]
export const SCREEN_HELP = {
  DASH: ['Your home page: the numbers and to-dos that matter for your role.', 'Check the cards each morning; click a needs-attention item to open it.'],
  STU_INS: ['Student numbers, attendance and fee trends (Power BI).', 'Use the grade and month filters; export from the report menu.'],
  STU_LIST: ['Every student with class, guardian and transport.', 'Search by name or admission number; click a student to open the profile.'],
  STU_ADMISSIONS: ['Enquiries and applications for next year, from first call to enrolment, with a summary by grade.', 'Add an enquiry or application form; move it Submitted → In review → Offered → Enrolled, or Opted out with a reason. Website enquiries arrive here automatically.'],
  STU_ADMIT: ['Admit a student directly (without the enquiry pipeline).', 'Fill child, class-section, guardian and transport; the admission number is generated.'],
  STU_ATT: ['Daily class attendance.', 'Pick the class; tap a student to switch Present / Absent. Leave (approved) and Late (dropped by parent) come in from parent requests.'],
  STU_REQUESTS: ['Coordinator Desk: leave, early-leave, pickup, drop and transport requests for the sections you coordinate.', 'Approve or decline (a reason is needed); approving an early leave sends the parent a gate code.'],
  STU_MEETINGS: ['Parents asking to meet or call you.', 'Click Reply, pick a date and time (or decline with a note); the parent is told by email and in the app.'],
  STU_OFFICE: ['Certificates, documents and queries sent by parents.', 'Open item → Update → Mark done with a message (e.g. "Ready at the office"), or decline.'],
  STU_GATE: ['Gate Desk: today’s collections and expected late arrivals; checking new pickup people.', 'Check photo ID, enter the 4-digit gate code, Hand over. For late arrivals press Arrived. "Approve pickup people" checks new collectors.'],
  STU_PROMOTE: ['Promote a class to the next year or transfer a student out.', 'Choose class and target; review the list; confirm.'],
  STU_DOCS: ['Documents and ID cards.', 'Upload or print certificates and ID cards from the school’s templates.'],
  STF_INS: ['Staff numbers, attendance and leave trends.', 'Filter by department.'],
  STF_LIST: ['Every staff member.', 'Search; open a profile to edit.'],
  STF_ADD: ['Add a staff member.', 'Fill details; a set-password link is emailed if they get an account.'],
  STF_ATT: ['Staff attendance.', 'Mark present / absent / on leave per day.'],
  STF_LEAVE: ['Staff leave requests.', 'Staff apply; the Principal approves or declines.'],
  ACA_CLASS: ['Classes and sections with capacity.', 'Add sections; set capacity (used for admissions seats).'],
  ACA_COORD: ['Primary and secondary class coordinator for each section.', 'Pick two different teachers per section; they receive that section’s parent requests.'],
  ACA_SYLLABUS: ['Boards, textbooks, chapters and topics.', 'Pick the board and class; chapters feed question papers.'],
  ACA_TIMETABLE: ['Class and teacher timetables.', 'Click a cell to set subject and teacher; clashes are flagged. Parents see their child’s.'],
  EXM_QP: ['Build each exam paper from the topics you choose: sets, versions, approval and printing.', 'Pick the exam → Start a class and subject → tick chapters and topics (the paper rebuilds itself) → adjust questions → Add sets → Send each set for approval → choose the set for the exam.'],
  EXM_APPROVED: ['Approved sets ready for the exam.', 'Pick the exam → Print the chosen set, its answer key or the teacher’s copy.'],
  EXM_QB: ['Chapters, topics and questions per class and subject (Easy / Medium / Hard).', 'Pick the class and subject → add chapters and topics → add, edit, duplicate or archive questions; teachers’ new questions go to review.'],
  EXM_FORMATS: ['Blueprints: the pattern of each kind of paper (sections, types, marks, OR choices, chapters).', 'Edit or copy a blueprint; papers pick the one that fits their exam and class.'],
  EXM_COSCH: ['Co-scholastic grades (A/B/C).', 'Pick class and area; set grades.'],
  EXM_PROFILE: ['Assessment profiles and appreciation cards.', 'Write subject comments; print the profile.'],
  FEE_INS: ['Fee collection, dues and trends (Power BI).', 'Filter by grade and month.'],
  FEE_COLLECT: ['Take a fee payment at the counter.', 'Find the student, pick invoices, mode (cash / card / UPI), save; the receipt prints in the school’s format.'],
  FEE_REQUESTS: ['Send fee request emails by grade with a personal pay link.', 'Pick grades and instalment → Preview → Send. Parents without email get an SMS.'],
  FEE_MATCHING: ['Match incoming bank / UPI / gateway payments to fee requests.', 'Most match automatically; for the rest pick the request and Match. Duplicates are flagged.'],
  FEE_DUES: ['Who owes what, with reminders.', 'Filter overdue; send reminders; open an invoice.'],
  FEE_RECEIPTS: ['All receipts.', 'Search, reprint or email a receipt.'],
  FEE_STRUCT: ['Fee heads and amounts per grade and instalment.', 'Edit heads and amounts for the year.'],
  FEE_CONC: ['Concessions and scholarships.', 'Add a concession for a student; it applies to new invoices.'],
  TRN_MANIFEST: ['Daily bus manifest: who boards, who doesn’t and why, for morning and afternoon.', 'Pick date, trip and route. With attendant tracking on, mark Boarded / No-show. Send to transport team.'],
  TRN_SHEETS: ['One route sheet per driver with stop timings and who to wait for.', 'Pick the day → Send to all drivers (each gets only their route by SMS link) or Download all (Excel).'],
  TRN_CHANGES: ['Every request that changes the bus, today and coming days.', 'Read-only list for transport and front office.'],
  TRN_ROUTES: ['Routes, stops, bus, driver, attendant and stop times.', 'Edit stop times; they are checked for order and school times.'],
  ANL_HOME: ['Catalogue of Power BI reports.', 'Open a report.'],
  ANL_RANK: ['Top 6 and bottom 6 per grade.', 'Pick grade (and sections, term, subject).'],
  ANL_TRANSPORT: ['Route use, cost per km, on-time and fee revenue.', 'Filter by grade.'],
  ANL_TEACHER: ['How each teacher’s students are doing.', 'Filter by grade and subject. The Principal or Head of Teaching Staff can share it with teachers (view only).'],
  ANL_ADMISSIONS: ['Admissions funnel and conversion.', 'Filter by grade and source.'],
  PAY_RUN: ['Monthly payroll.', 'Pick the month → check → Approve → Post to accounts; payslips are released.'],
  PAY_SLIPS: ['All payslips.', 'Search and print.'],
  ACC_BANK: ['The school’s bank and UPI details shown on invoices.', 'Edit; a second person (Principal) approves before it is used.'],
  ACC_STMT: ['Account statement with running balance.', 'Pick account and dates.'],
  ACC_EXP: ['Income and expenses.', 'Add expenses; see the summary.'],
  OPS_USERS: ['Accounts: approve sign-ups, add users, change roles, designation, status, reset passwords, delete.', 'Add user or Review a sign-up → pick the role (the designation list then shows only that role’s designations; parents are simply Parent) → Active.'],
  OPS_ROLES: ['User management: profiles, departments and designations; add from the standard list for Indian schools or delete profiles. Permissions by department: No access, Read only or Full access for each main menu and sub-menu. Access summary: each person, their profile, department, designation and what they can open.', 'Permissions by department → pick a department → set a main menu (all its sub-menus) or expand it and set single sub-menus. Read only opens the screen but blocks saving. Access summary → filter by department or profile → Show access.'],
  OPS_TEMPLATES: ['Invoices, receipts, emails, payslips and letters in the school’s own format.', 'Use standard, Copy & edit, or Upload; set the default.'],
  OPS_IMPORT: ['Bring in data from Excel, CSV or photos.', 'Upload → map columns → map values → check → Import (can be rolled back).'],
  OPS_CHANNELS: ['Which screens each role sees on the website, in the mobile app, or both.', 'Pick a role → choose Website + app / Website only / App only → Send for approval → the Principal approves → published.'],
  OPS_APPEARANCE: ['Layout, colours and fonts.', 'Pick a template and colour → Publish.'],
  OPS_WEBSITE: ['Links between the app and the school website.', 'Copy deep links and the admission-form snippet into the school website.'],
  OPS_OUTBOX: ['Every email and SMS the app has sent (test inbox).', 'Open a message to read it.'],
  OPS_SMS: ['Connect an SMS provider (MSG91, Amazon SNS, Gupshup, Twilio or your own API).', 'Choose provider → DLT template IDs → Dry run → Go live.'],
  SELF_CHILD: ['Your child’s profile, attendance and results.', 'Pick the child if you have more than one.'],
  SELF_REQUESTS: ['Send the school a request: leave, late arrival, pickup or drop in person, early leave, own transport, meet a teacher, certificate or query.', 'Pick the request card → fill the form → Send. Track status and gate codes below; cancel while open.'],
  SELF_FEES: ['Fee dues and payment.', 'Pay online, or pay by bank transfer and enter the UTR.'],
  SELF_PAYSLIP: ['Your payslips.', 'Open and print.'],
  SELF_MYPERF: ['Your own teaching results (only when shared).', 'Read-only.'],
  SELF_PROFILE: ['Your account: name, email or mobile, password, notifications, linked children; delete your account.', 'Change details (a code confirms new email or mobile).'],
  SELF_PREFS: ['Your display preferences.', 'Pick layout density and theme.'],
  PLT_SCHOOLS: ['Platform Console: schools, plans, modules, functions and the mobile app switch.', 'Pick a school → plan → switch modules / sub-menus / functions → Mobile app on or off.'],
  VA_PARENT: ['Admin only: see the website and phone app exactly as a parent sees them.', 'Click it; a bar shows who you are viewing as. Switch Website / Phone app; Back to Admin returns. Preview only unless you tick “Act as this person”.'],
  VA_TEACHER: ['Admin only: see the app as a teacher who is a class coordinator.', 'As above.'],
  VA_VP: ['Admin only: see the app as a teacher who is also Vice Principal (designation adds Users, Admissions and analytics).', 'As above.'],
  VA_HOTS: ['Admin only: see the app as a teacher who is Head of Teaching Staff.', 'As above.'],
  VA_PRINCIPAL: ['Admin only: see the app as the Principal.', 'As above.'],
  VA_ACCOUNTANT: ['Admin only: see the app as the Accountant.', 'As above.'],
  VA_FRONT_OFFICE: ['Admin only: see the app as the Front Office.', 'As above.'],
  VA_TRANSPORT: ['Admin only: see the app as the Transport team.', 'As above.'],
  HELP_GUIDE: ['This guide: guided demos, every menu explained, and what each role sees.', 'Start a guided demo — the bar at the bottom walks you through each step and signs you in as the right person.']
};

// Guided demos: each step signs in as a demo person and opens a screen ("public" steps open a page without signing in)
export const WORKFLOWS = [
  { id: 'leave', title: 'Parent leave request → coordinator → attendance and bus', time: '3 min', roles: 'Parent, Teacher (coordinator), Transport', steps: [
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Click "Leave (child will be absent)". Choose Aarav, tomorrow to the day after, reason "Family function". Send request.', check: 'Status: Waiting for coordinator.' },
    { as: 'U4', screen: 'STU_REQUESTS', do: 'Sonia coordinates 8-A. Find Aarav’s leave and click Approve.', check: 'Status Approved; the parent is emailed.' },
    { as: 'U4', screen: 'STU_ATT', do: 'Open 8-A attendance for tomorrow’s date (if the date picker shows today, that’s fine — leave appears on the leave days).', check: 'Aarav shows "On leave (approved)".' },
    { as: 'U20', screen: 'TRN_SHEETS', do: 'Pick tomorrow and Aarav’s route.', check: 'Aarav is marked ✗ — On leave; the driver does not wait.' },
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Back as the parent.', check: 'The leave shows Approved.' }] },
  { id: 'early', title: 'Early leave with a gate code', time: '3 min', roles: 'Parent, Coordinator, Front Office, Transport', steps: [
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Click "Early leave". Today (or tomorrow), time 12:30, collected by Rohit Sharma, reason "Doctor". Send.', check: 'Waiting for coordinator.' },
    { as: 'U4', screen: 'STU_REQUESTS', do: 'Approve the early leave.', check: 'A 4-digit gate code is created and sent to the parent.' },
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Note the gate code in the Gate code column.', check: 'Code shown only to the parent.' },
    { as: 'U5', screen: 'STU_GATE', do: 'Find Aarav, check ID, type the gate code, Hand over. (Only works on the request’s date.)', check: 'Handed over with the time.' },
    { as: 'U20', screen: 'TRN_MANIFEST', do: 'Afternoon trip for that day.', check: 'Aarav: Not boarding — left early with Rohit Sharma.' }] },
  { id: 'late', title: 'Late arrival: parent drops the child', time: '2 min', roles: 'Parent, Front Office, Teacher', steps: [
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Click "Late arrival". Today, arriving at a time later today (after 08:45, before 15:00). Send.', check: 'Confirmed at once.' },
    { as: 'U5', screen: 'STU_GATE', do: 'Under "Expected late arrivals today", click Arrived when the child comes in.', check: 'Coordinators are told.' },
    { as: 'U4', screen: 'STU_ATT', do: 'Open 8-A attendance for today.', check: 'Aarav shows "Late — dropped by parent".' }] },
  { id: 'meeting', title: 'Parent asks to meet a teacher', time: '2 min', roles: 'Parent, Teacher', steps: [
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Click "Meet or call a teacher". Pick Sonia Mehta, Phone call, preferred date and time, topic "Maths homework". Send.', check: 'Waiting for teacher.' },
    { as: 'U4', screen: 'STU_MEETINGS', do: 'Click Reply on the request; pick a date and time → Confirm time.', check: 'Confirmed; the parent is emailed.' },
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Back as the parent.', check: 'Shows Confirmed with the date and time.' }] },
  { id: 'office', title: 'Certificate request to the office', time: '1 min', roles: 'Parent, Front Office', steps: [
    { as: 'U6', screen: 'SELF_REQUESTS', do: 'Click "Other request". Bonafide / study certificate, needed by next week, details "Passport". Send.', check: 'With the office.' },
    { as: 'U5', screen: 'STU_OFFICE', do: 'Update → message "Ready at the office after 2 pm" → Mark done.', check: 'The parent sees Done with the message.' }] },
  { id: 'admission', title: 'Website enquiry → enrolled student', time: '4 min', roles: 'Public visitor, Front Office, Principal', steps: [
    { public: '#/p/apply', do: 'Open the public admission form (new tab, no sign-in). Fill child, date of birth, parent, mobile; tick consent; Send enquiry.', check: 'A reference number is shown.' },
    { as: 'U5', screen: 'STU_ADMISSIONS', do: 'Applications tab: find the new enquiry. Move it to Submitted (add documents), In review, Offered.', check: 'Each move emails the parent.' },
    { as: 'U5', screen: 'STU_ADMISSIONS', do: 'Move it to Enrolled.', check: 'A student is created with an admission number.' },
    { as: 'U2', screen: 'ANL_ADMISSIONS', do: 'Look at the funnel by grade and source.', check: 'Website enquiries counted.' }] },
  { id: 'fees', title: 'Fee request → online payment → automatic matching', time: '4 min', roles: 'Accountant, Parent', steps: [
    { as: 'U3', screen: 'FEE_REQUESTS', do: 'Choose Grade VIII → Preview → Send.', check: 'Emails in the outbox, one per guardian, each with a pay link.' },
    { as: 'U6', screen: 'SELF_FEES', do: 'Pay online (simulated).', check: 'Receipt and confirmation email.' },
    { as: 'U3', screen: 'FEE_MATCHING', do: 'See the payment matched automatically. Use "Simulate" to try a bank line with only the admission number in the narration.', check: 'Matched by narration; duplicates flagged.' },
    { as: 'U3', screen: 'FEE_RECEIPTS', do: 'Open the new receipt.', check: 'In the school’s receipt format.' }] },
  { id: 'exams', title: 'Question paper: topics → sets → approve → print', time: '4 min', roles: 'Teacher, Principal', steps: [
    { as: 'U4', screen: 'EXM_QP', do: 'Exam Unit Test 2 → Class 6 Mathematics → Open. Show the topics of a chapter and untick one: the paper rebuilds from the remaining topics.', check: 'Every question is from a ticked topic; the table shows what the topics hold per section.' },
    { as: 'U4', screen: 'EXM_QP', do: 'Add a set → Send set 1 for approval.', check: 'Overlap between sets shown; set 1 locked while it waits.' },
    { as: 'U2', screen: 'EXM_QP', do: 'Open Class 6 Mathematics → Set 1 → Approve → choose Set 1 for the exam.', check: 'Set 1 is the set for the exam; the others are sealed.' },
    { as: 'U4', screen: 'EXM_APPROVED', do: 'Unit Test 2 → Print, Answer key or Teacher’s copy.', check: 'Print views of the chosen set.' }] },
  { id: 'payroll', title: 'Monthly payroll', time: '2 min', roles: 'Accountant, Teacher', steps: [
    { as: 'U3', screen: 'PAY_RUN', do: 'Pick the month → check figures → Approve → Post.', check: 'Voucher posted to accounts.' },
    { as: 'U4', screen: 'SELF_PAYSLIP', do: 'Open the payslip.', check: 'Shows basic, allowances, PF, TDS and net.' }] },
  { id: 'signup', title: 'New account from the app → approval in Users', time: '3 min', roles: 'Parent or staff (new), Admin', steps: [
    { public: '#/p/mobile', do: 'Phone app → school code GVS → Create an account. Pick Parent (give the child’s admission number) or a staff role — e.g. Transport team → designation Driver. Verify the code (shown on screen), set a password.', check: 'Account created, waiting for approval; details emailed (never the password).' },
    { as: 'U1', screen: 'OPS_USERS', do: 'The new account is at the top as “Waiting for approval”. Review → the role asked for is filled in and the designation list shows only that role’s designations → status Active → Save.', check: 'The person can now sign in.' }] },
  { id: 'adduser', title: 'Add a user: designations follow the role', time: '2 min', roles: 'Admin', steps: [
    { as: 'U1', screen: 'OPS_USERS', do: 'Add user → Role Transport team: the designations are Transport In-charge, Transport Supervisor, Driver, Cleaner, Bus Helper / Attendant. Change the role to Parent: the designation is simply Parent.', check: 'Each role offers only its own designations.' },
    { as: 'U1', screen: 'OPS_ROLES', do: 'User management → Transport team (department Transport) → add the designation “Route Marshal”.', check: 'It is offered next time a Transport user is added.' }] },
  { id: 'viewas', title: 'See the app as each profile (Admin)', time: '2 min', roles: 'Admin', steps: [
    { as: 'U1', screen: 'HOME', do: 'Main menu → View as Profile → Parent (the same items are in the side menu).', check: 'The menus change to the parent’s; a bar says who you are viewing as.' },
    { as: 'U1', screen: 'HOME', do: 'In the bar, switch to Phone app, then Back to Admin.', check: 'The parent’s phone tabs; changes are blocked unless you tick “Act as this person”.' }] },
  { id: 'channels', title: 'Choose what shows on the website and in the app', time: '3 min', roles: 'Admin, Principal', steps: [
    { as: 'U1', screen: 'OPS_CHANNELS', do: 'Role Teacher → Leave Requests → "Website + app". Role Front Office → Gate Desk → "App only".', check: 'A draft starts; the preview shows the new phone tabs and website menu.' },
    { as: 'U1', screen: 'OPS_CHANNELS', do: 'Send for approval with a note.', check: 'Status: Waiting for approval; the Principal is emailed.' },
    { as: 'U2', screen: 'OPS_CHANNELS', do: 'Check "What the draft changes" → Approve and publish.', check: 'Published as a new version; history kept.' },
    { as: 'U5', screen: 'STU_OFFICE', do: 'As Front Office on the website.', check: 'Gate Desk is gone from the website menu (it is app only now).' },
    { public: '#/p/mobile', do: 'Open the phone preview, school code GVS, demo account Anita Rao.', check: 'Gate is a tab in the app.' }] },
  { id: 'platform', title: 'Onboard a school (platform team)', time: '3 min', roles: 'Platform team, Admin', steps: [
    { as: 'U8', screen: 'PLT_SCHOOLS', do: 'Pick a school → plan → switch modules, sub-menus and functions → switch the mobile app on.', check: 'Only those menus appear for that school.' },
    { as: 'U8', screen: 'OPS_CHANNELS', do: 'Start from recommended → adjust → Send for approval (the platform team can approve too, but a different person must).', check: 'Draft waiting for approval.' },
    { as: 'U1', screen: 'OPS_WEBSITE', do: 'Copy the deep links and the admission-form snippet for the school website.', check: 'Each school has its own addresses.' }] },
  { id: 'transport', title: 'A day for the transport team', time: '3 min', roles: 'Transport', steps: [
    { as: 'U20', screen: 'TRN_ROUTES', do: 'Open a route; change a stop time.', check: 'Times checked for order.' },
    { as: 'U20', screen: 'TRN_SHEETS', do: 'Pick the day → What the driver sees → Send to all drivers.', check: 'Each driver gets only their route.' },
    { as: 'U20', screen: 'TRN_MANIFEST', do: 'Morning trip; mark Boarded / No-show.', check: 'Not-boarding children show the reason.' }] },
  { id: 'analytics', title: 'Results and teacher performance', time: '2 min', roles: 'Principal, Head of Teaching Staff, Teacher', steps: [
    { as: 'U2', screen: 'ANL_RANK', do: 'Grade IX, all sections; then pick two sections.', check: 'Top 6 and bottom 6 change.' },
    { as: 'U21', screen: 'ANL_TEACHER', do: 'Switch "Share with teachers" on.', check: 'Teachers get My Teaching Performance (view only).' },
    { as: 'U4', screen: 'SELF_MYPERF', do: 'As a teacher.', check: 'Only her own subjects and sections.', needs: 'Opens only after step 2 (Share with teachers) is switched on; otherwise you land on the dashboard.' }] }
];
