# -*- coding: utf-8 -*-
"""Content for the client review PDF: menus, screens, fields, onboarding."""

PLAN = {1: "All plans", 2: "Growth+", 3: "Professional+", 4: "Enterprise"}

# Each module: (number, name, purpose, [screens])
# Each screen: (sub-menu, screen type, used by, plan rank, [fields])
# Each field: (name, type, required, note)  -- required: True / False
R = True
O = False

MODULES = [
 ("1", "Dashboard", "The home page. What it shows depends on who signs in.", [
  ("Role-based home", "Dashboard", "Everyone", 1, [
   ("Greeting & date", "Header", O, "Name, role, today"),
   ("Key number tiles (4)", "Tiles", O, "Admin: students, staff, collected, dues · Teacher: my class · Parent: fee due, attendance"),
   ("Recent activity — When", "Column", O, ""),
   ("Recent activity — Item", "Column", O, "Receipt, admission, expense, payroll"),
   ("Recent activity — By", "Column", O, ""),
   ("Recent activity — Amount", "Column", O, "₹"),
   ("Recent activity — Status", "Column", O, "Paid · Draft · Pending"),
   ("Quick actions", "Buttons", O, "Change by role"),
   ("Needs attention", "List", O, "Approvals, locked users, missing attendance"),
  ]),
  ("Notifications inbox", "List", "Everyone", 1, [
   ("Date & time", "Column", O, ""), ("Type", "Column", O, "Approval · Reminder · Notice"),
   ("Message", "Column", O, ""), ("From", "Column", O, ""), ("Read / unread", "Column", O, ""),
  ]),
 ]),
 ("2", "Students", "Admissions, records, attendance and documents.", [
  ("Insights", "Power BI report", "Admin, Principal", 2, [
   ("Enrolment & capacity", "Report page", O, "Students by class vs seats, admissions, withdrawals"),
   ("Attendance patterns", "Report page", O, "Daily %, chronic absentees, day-of-week view"),
   ("Students at risk", "Report page", O, "Low attendance + overdue fees + falling marks"),
  ]),
  ("All Students", "List", "Admin, Principal, Front Office, Teacher (own class)", 1, [
   ("Admission no.", "Column", O, "Unique per school"), ("Student name", "Column", O, ""),
   ("Class – Section", "Column", O, ""), ("Roll no.", "Column", O, ""),
   ("Guardian name", "Column", O, ""), ("Guardian mobile", "Column", O, "Masked for non-admin roles"),
   ("Fee status", "Column", O, "Paid · Due · Overdue"), ("Attendance %", "Column", O, "This term"),
   ("Status", "Column", O, "Active · Transferred · Left · Alumni"),
   ("Filters", "Bar", O, "Class, section, status, fee status, search"),
  ]),
  ("New Admission", "Form (4 steps)", "Admin, Front Office", 1, [
   ("Admission no.", "Auto", R, "e.g. ADM-2026-0412"), ("First name", "Text", R, ""), ("Last name", "Text", O, ""),
   ("Date of birth", "Date", R, ""), ("Gender", "Select", R, ""), ("Blood group", "Select", O, ""),
   ("Admission date", "Date", R, ""), ("Previous school", "Text", O, ""), ("Photo", "File", O, ""),
   ("Home address", "Text area", O, ""),
   ("Guardian full name", "Text", R, "Step 2"), ("Relation", "Select", R, "Father · Mother · Guardian"),
   ("Guardian mobile", "Phone", R, "Used for SMS / WhatsApp"), ("Guardian email", "Email", O, ""),
   ("Occupation", "Text", O, ""), ("Alternate mobile", "Phone", O, ""),
   ("Create parent app login", "Toggle", O, "Creates a Parent user, own-child access"),
   ("Academic year", "Select", R, "Step 3"), ("Class", "Select", R, ""), ("Section", "Select", R, "Shows seats used / capacity"),
   ("Roll no.", "Auto", R, ""), ("Transport route & stop", "Select", O, ""), ("House / group", "Select", O, ""),
   ("Fee plan preview", "Table", O, "Fee head · frequency · amount · concession · net"),
   ("Concession", "Select", O, "Sibling · Staff ward · Merit (needs approval)"),
   ("Documents", "Files", O, "Step 4: birth certificate, TC, photo, guardian ID"),
  ]),
  ("Attendance", "Grid", "Teacher (own class), Admin, Principal", 1, [
   ("Date", "Date", R, ""), ("Class – Section", "Select", R, ""), ("Period", "Select", O, "Only if period-wise attendance is on"),
   ("Roll / Student", "Column", O, ""), ("Status", "P / A / Late / Leave", R, "One tap per student"),
   ("Remarks", "Text", O, ""), ("Notify absent parents", "Toggle", O, "SMS / WhatsApp / app"),
  ]),
  ("Promote / Transfer", "Wizard", "Admin", 2, [
   ("From year & class", "Select", R, ""), ("To class & section", "Select", R, ""),
   ("Student list with result", "Table", R, "Promoted · Detained · Left"),
   ("Transfer certificate date", "Date", O, ""), ("Reason for leaving", "Text", O, ""),
  ]),
  ("Documents & ID Cards", "List + print", "Admin, Front Office", 1, [
   ("Student", "Lookup", R, ""), ("Document type", "Select", R, ""), ("File", "File", R, ""),
   ("Uploaded on", "Auto", O, ""), ("Verified by", "Auto", O, ""), ("ID card template & print batch", "Action", O, "Growth+: bulk ID cards"),
  ]),
 ]),
 ("3", "Staff", "Staff records, attendance and leave.", [
  ("Insights", "Power BI report", "Admin, Principal", 2, [
   ("Staff mix & ratio", "Report page", O, "Student–teacher ratio, teaching vs non-teaching"),
   ("Leave & absence", "Report page", O, "Leave days by type and department"),
   ("Tenure & attrition", "Report page", O, "Joiners, leavers, average tenure"),
  ]),
  ("All Staff", "List", "Admin, Principal, Accountant (view)", 1, [
   ("Employee code", "Column", O, ""), ("Name", "Column", O, ""), ("Department", "Column", O, ""),
   ("Designation", "Column", O, ""), ("Employment type", "Column", O, ""), ("Mobile", "Column", O, ""),
   ("Joining date", "Column", O, ""), ("Status", "Column", O, "Active · On leave · Resigned"),
  ]),
  ("Add Staff", "Form (5 tabs)", "Admin", 1, [
   ("Employee code", "Auto", R, ""), ("First name", "Text", R, ""), ("Last name", "Text", O, ""),
   ("Gender", "Select", O, ""), ("Date of birth", "Date", O, ""), ("Mobile", "Phone", R, ""), ("Email", "Email", R, ""),
   ("Qualification", "Text", O, ""), ("Photo", "File", O, ""),
   ("Department", "Select", R, "Employment tab"), ("Designation", "Select", R, ""), ("Employment type", "Select", R, "Permanent · Contract · Part-time"),
   ("Joining date", "Date", R, ""), ("Reports to", "Select", O, ""), ("Class teacher of", "Select", O, ""),
   ("Bank name", "Text", O, "Bank tab"), ("Account number", "Encrypted", O, "Visible to Admin & Accountant only"),
   ("IFSC", "Text", O, ""), ("PAN / tax ID", "Encrypted", O, ""), ("PF number", "Text", O, ""),
   ("Salary components & amounts", "Table", O, "Earnings and deductions → net pay"), ("Effective from", "Date", O, ""),
   ("Username", "Text", O, "Login tab"), ("Send invite by", "Select", O, "Email · SMS"), ("Roles", "Multi-select", O, "Teacher, Front Office, Accountant …"),
  ]),
  ("Staff Attendance", "Grid", "Admin, Principal", 1, [
   ("Date", "Date", R, ""), ("Staff", "Column", O, ""), ("Status", "Select", R, "Present · Absent · Half day · Leave"),
   ("In / out time", "Time", O, ""), ("Source", "Auto", O, "Manual · Biometric (Enterprise)"),
  ]),
  ("Leave Requests", "List + approve", "Teacher (own), Principal (approve)", 1, [
   ("Staff", "Column", O, ""), ("Leave type", "Select", R, "Casual · Sick · Earned · Unpaid"),
   ("From / To", "Date", R, ""), ("Days", "Auto", O, ""), ("Reason", "Text", O, ""),
   ("Status", "Column", O, "Pending · Approved · Rejected"), ("Approved by", "Auto", O, ""),
  ]),
  ("Departments & Designations", "Setup list", "Admin", 1, [
   ("Name", "Text", R, ""), ("Teaching role", "Toggle", O, ""), ("Head of department", "Select", O, ""),
  ]),
 ]),
 ("4", "Academics", "Years, classes, subjects and the board / textbook link.", [
  ("Academic Years", "Setup list", "Admin", 1, [
   ("Name", "Text", R, "e.g. 2026-27"), ("Start date", "Date", R, ""), ("End date", "Date", R, ""), ("Current year", "Toggle", R, ""),
  ]),
  ("Classes & Sections", "Setup list", "Admin", 1, [
   ("Class", "Text", R, "Nursery … Grade 12"), ("Level no.", "Number", R, ""), ("Board", "Select", R, "CBSE · ICSE · State · IB"),
   ("Section", "Text", R, "A, B, C"), ("Class teacher", "Select", O, ""), ("Capacity", "Number", O, ""),
  ]),
  ("Subjects", "Setup list", "Admin", 1, [
   ("Subject code", "Text", R, ""), ("Name", "Text", R, ""), ("Board subject code", "Text", O, "e.g. CBSE 041"),
   ("Classes taught", "Multi-select", O, ""), ("Teachers", "Multi-select", O, ""),
  ]),
  ("Boards, Syllabus & Textbooks", "Library", "Admin, Principal, Teacher (view)", 1, [
   ("Board", "Tabs", R, "CBSE · ICSE / ISC · State board · IB"), ("Grades & affiliation no.", "Text", O, ""),
   ("Subject", "Column", O, ""), ("Textbook(s)", "Column", O, "Title, publisher, edition"),
   ("Units & board weightage", "Column", O, "Marks per unit"), ("Chapters → topics", "Tree", O, "Used by the paper generator"),
   ("Questions in bank", "Column", O, "Shows thin areas"),
  ]),
 ]),
 ("5", "Exams", "Question bank, paper generator, approval & printing, co-scholastic grades.", [
  ("Papers › Question Papers", "Builder (4 steps)", "Teacher, Principal, Admin", 1, [
   ("Board / Class / Subject / Textbook", "Select", R, "Step 1"), ("Exam", "Select", R, "Unit · Periodic · Half-yearly · Pre-board · Sample"),
   ("Exam date", "Date", O, ""), ("Chapters & topics", "Checklist", R, "Shortcuts: half-yearly / full syllabus"),
   ("Difficulty mix", "Preset", R, "Practice 50/40/10 · Balanced 30/50/20 · Challenging 15/45/40"),
   ("Paper format", "Select", R, "CBSE board pattern, ICSE, periodic 40, unit 25, state template"),
   ("Sets", "Select", O, "A / B / C with no repeats (Growth+)"),
   ("Skip questions used in last 12 months", "Toggle", O, ""), ("Internal choice (OR)", "Toggle", O, ""),
   ("Blueprint & bank check", "Table", O, "Section · type · count · marks · available"),
   ("Generated paper preview", "Document", O, "Header, instructions, sections, marks [ ]"),
   ("Paper checks", "Panel", O, "Total, difficulty achieved, competency %, coverage"),
   ("Submit to HOD", "Action", O, ""),
  ]),
  ("Papers › Approved Papers", "List + print", "Principal, Admin, Teacher (view)", 1, [
   ("Paper", "Column", O, ""), ("Exam date", "Column", O, ""), ("Sets", "Column", O, ""), ("Prepared by", "Column", O, ""),
   ("Status", "Column", O, "HOD review · Awaiting approval · Locked · Printed"),
   ("Copies per set", "Number", R, "Default from class strength"), ("Watermark", "Toggle", O, "CONFIDENTIAL"),
   ("Roll-number box", "Toggle", O, ""), ("Answer key", "Toggle", O, "Separate, Principal only"), ("Paper size", "Select", O, "A4 single / double sided"),
  ]),
  ("Papers › Question Bank", "List + editor", "Teacher, Principal", 1, [
   ("Question ID", "Auto", O, ""), ("Board / Class / Subject", "Select", R, ""), ("Chapter › Topic", "Select", R, ""),
   ("Question type", "Select", R, "MCQ · Assertion–Reason · VSA · SA · LA · Case · Source · Map"),
   ("Marks", "Number", R, ""), ("Difficulty", "Select", R, "Easy · Intermediate · Tough"),
   ("Thinking level", "Select", O, "Remember … Create"), ("Competency-based", "Toggle", O, ""),
   ("Question text", "Rich text", R, "Maths symbols supported"), ("Options & correct answer", "List", O, "For MCQ / A–R"),
   ("Marking scheme", "Text", O, "Step marks"), ("Source", "Auto", O, "Teacher · AI draft · Licensed · Archive"),
   ("Status", "Select", O, "Draft · In review · Approved · Retired"), ("Times used / last used", "Auto", O, ""),
  ]),
  ("Papers › Paper Formats", "Setup", "Admin, Principal", 1, [
   ("Format name", "Text", R, ""), ("Board & grades", "Select", O, ""), ("Total marks", "Number", R, ""), ("Duration", "Minutes", R, ""),
   ("Sections", "Table", R, "Code · type · count · marks each · attempt any"), ("General instructions", "Text area", O, ""),
  ]),
  ("Co-Scholastic › Grades", "Grid", "Teacher (own class), Admin", 1, [
   ("Class & term", "Select", R, ""), ("Student", "Column", O, ""),
   ("Work Education", "Grade", R, "3-point I–VIII · 5-point IX–X"), ("Art Education", "Grade", R, ""),
   ("Health & Physical Education", "Grade", R, ""), ("Discipline", "Grade", R, ""), ("Remarks", "Text", O, ""),
  ]),
 ]),
 ("6", "Fees", "Accountant module: collection, dues, receipts and fee setup.", [
  ("Insights", "Power BI report", "Admin, Principal, Accountant", 2, [
   ("Collection vs billed", "Report page", O, "By month, class, fee head"), ("Overdue ageing & defaulters", "Report page", O, "1–30, 31–60, 61–90, 90+ days"),
   ("Payment modes & concessions", "Report page", O, ""),
  ]),
  ("Collect Fee", "Counter screen", "Accountant, Front Office", 1, [
   ("Find student", "Search", R, "Name, admission no., guardian mobile"), ("Student summary", "Card", O, "Class, guardian, total due"),
   ("Invoice no.", "Column", O, "Pending invoices table"), ("Period", "Column", O, ""), ("Fee heads", "Column", O, ""),
   ("Due date", "Column", O, ""), ("Net / Paid / Balance", "Column", O, "₹"), ("Status", "Column", O, "Due · Overdue"),
   ("Amount received", "Amount", R, "Total of ticked invoices"), ("Mode", "Select", R, "Cash · UPI · Card · Bank · Cheque · Online"),
   ("Transaction / cheque reference", "Text", R, "Not needed for cash"), ("Remarks", "Text", O, ""),
   ("Receipt no.", "Auto", R, ""), ("Accounting entry preview", "Table", O, "Dr Cash/Bank · Cr fee income"),
  ]),
  ("Dues & Reminders", "List", "Accountant, Front Office, Principal", 1, [
   ("Student / Class", "Column", O, ""), ("Overdue amount", "Column", O, "₹"), ("Days overdue", "Column", O, ""),
   ("Last reminder", "Column", O, ""), ("Channel", "Select", O, "SMS (Growth+) · WhatsApp (Professional+) · App"), ("Send reminder", "Action", O, ""),
  ]),
  ("Receipts", "List", "Accountant, Front Office", 1, [
   ("Receipt no.", "Column", O, ""), ("Date", "Column", O, ""), ("Student", "Column", O, ""), ("Amount", "Column", O, "₹"),
   ("Mode", "Column", O, ""), ("Collected by", "Column", O, ""), ("Status", "Column", O, "Success · Bounced · Refunded · Void"),
  ]),
  ("Fee Structure", "Setup grid", "Accountant, Admin", 1, [
   ("Academic year", "Select", R, ""), ("Class", "Select", R, ""), ("Fee head", "Select", R, "Tuition, transport, admission, exam …"),
   ("Frequency", "Select", R, "One-time · Monthly · Term · Annual"), ("Amount", "Amount", R, ""), ("Due day", "Number", O, ""),
   ("Income account", "Select", O, "Links to chart of accounts"),
  ]),
  ("Concessions", "List + approve", "Accountant, Principal (approve)", 2, [
   ("Student", "Lookup", R, ""), ("Fee head", "Select", R, ""), ("Type", "Select", R, "Percent · Flat"), ("Value", "Number", R, ""),
   ("Reason", "Select", R, "Sibling · Staff ward · Merit · Hardship"), ("Approved by", "Auto", O, ""),
  ]),
  ("Refunds", "List + approve", "Accountant, Principal (approve)", 2, [
   ("Receipt", "Lookup", R, ""), ("Amount", "Amount", R, ""), ("Reason", "Text", R, ""), ("Refund mode", "Select", R, ""), ("Approved by", "Auto", O, ""),
  ]),
 ]),
 ("7", "Payroll", "Accountant module: monthly salary run and payslips.", [
  ("Insights", "Power BI report", "Admin, Principal, Accountant", 2, [
   ("Payroll cost by department", "Report page", O, ""), ("Salary trend & headcount", "Report page", O, ""), ("Payroll vs fee income", "Report page", O, ""),
  ]),
  ("Run Payroll", "Run screen", "Accountant (prepare), Principal (approve)", 2, [
   ("Month", "Select", R, ""), ("Status steps", "Tracker", O, "Draft → Principal approval → Bank transfer → Paid"),
   ("Totals", "Tiles", O, "Staff, gross, deductions, net"), ("Staff", "Column", O, ""), ("Designation", "Column", O, ""),
   ("Paid days", "Column", O, "Loss-of-pay from attendance"), ("Gross / Deductions / Net", "Column", O, "₹"),
   ("Note", "Column", O, "Pro-rata, advance recovery"), ("Accounting entry on approval", "Panel", O, "Dr Salaries · Cr Payable"),
  ]),
  ("Payslips", "List", "Accountant; staff see their own", 2, [
   ("Month", "Column", O, ""), ("Staff", "Column", O, ""), ("Gross / Deductions / Net", "Column", O, ""), ("Paid on", "Column", O, ""), ("Download PDF", "Action", O, ""),
  ]),
  ("Salary Structure", "Setup", "Accountant", 2, [
   ("Component", "Text", R, "Basic, HRA, DA, PF, tax …"), ("Kind", "Select", R, "Earning · Deduction"),
   ("Calculation", "Select", R, "Fixed · % of basic"), ("Default value", "Number", O, ""),
  ]),
  ("Advances & Deductions", "List", "Accountant", 3, [
   ("Staff", "Lookup", R, ""), ("Amount", "Amount", R, ""), ("Instalments", "Number", R, ""), ("Balance", "Auto", O, ""),
   ("Issued on", "Date", R, ""), ("Approved by", "Auto", O, ""),
  ]),
 ]),
 ("8", "Accounts", "Accountant module: double-entry books and statements.", [
  ("Insights", "Power BI report", "Admin, Principal, Accountant", 3, [
   ("Income vs expenses", "Report page", O, ""), ("Cash flow & bank balance", "Report page", O, ""), ("Expense by category", "Report page", O, ""),
  ]),
  ("Account Statement", "Ledger", "Accountant, Principal (view)", 3, [
   ("Ledger account", "Select", R, ""), ("From / To", "Date", R, ""), ("Voucher type", "Select", O, "Receipt · Payment · Journal · Contra"),
   ("Search narration", "Text", O, ""), ("Summary", "Tiles", O, "Opening, debits, credits, closing"),
   ("Date", "Column", O, ""), ("Voucher no. & type", "Column", O, ""), ("Narration", "Column", O, ""),
   ("Source", "Column", O, "Fees · Payroll · Expense · Refund · Manual (click to open)"),
   ("Debit / Credit", "Column", O, "₹"), ("Running balance", "Column", O, ""), ("Export", "Action", O, "PDF · Excel"),
  ]),
  ("Income & Expenses", "List + form", "Accountant, Principal (approve)", 3, [
   ("Date", "Date", R, ""), ("Category (expense account)", "Select", R, ""), ("Vendor", "Text", O, ""), ("Amount", "Amount", R, ""),
   ("Paid from", "Select", R, "Cash · Bank"), ("Bill", "File", O, ""), ("Status", "Select", O, "Pending · Approved · Paid"),
  ]),
  ("Cash & Bank Book", "Ledger", "Accountant", 3, [
   ("Date", "Column", O, ""), ("Voucher", "Column", O, ""), ("Particulars", "Column", O, ""), ("In / Out", "Column", O, ""), ("Balance", "Column", O, ""),
   ("Bank reconciliation", "Action", O, "Enterprise or add-on"),
  ]),
  ("Chart of Accounts", "Setup tree", "Accountant", 3, [
   ("Code", "Text", R, ""), ("Name", "Text", R, ""), ("Type", "Select", R, "Asset · Liability · Equity · Income · Expense"),
   ("Parent group", "Select", O, ""), ("Opening balance", "Amount", O, ""), ("Active", "Toggle", O, ""),
  ]),
  ("Financial Reports", "Reports", "Accountant, Principal", 3, [
   ("Day book", "Report", O, ""), ("Trial balance", "Report", O, ""), ("Income & expenditure", "Report", O, ""),
   ("Balance sheet", "Report", O, ""), ("Fee collection register", "Report", O, ""),
  ]),
 ]),
 ("9", "Operations", "User management and school-level configuration.", [
  ("Insights", "Power BI report", "Admin, Principal", 3, [
   ("Logins & app adoption", "Report page", O, ""), ("Feature usage", "Report page", O, ""), ("Notifications vs credit", "Report page", O, ""),
  ]),
  ("Users", "List", "Admin", 1, [
   ("Name & username", "Column", O, ""), ("Linked record", "Column", O, "Staff · Guardian · Student"), ("Roles", "Column", O, ""),
   ("Status", "Column", O, "Active · Locked · Invited · Disabled"), ("Last sign-in", "Column", O, ""),
   ("Actions", "Buttons", O, "Edit roles · Reset password · Unlock · Resend invite"),
  ]),
  ("Roles & Permissions", "Matrix", "Admin", 1, [
   ("Role", "Tabs", R, "System roles + custom roles (Professional+)"), ("Module", "List", R, ""), ("Sub-menu", "Row", R, ""),
   ("View / Create / Edit / Delete / Approve", "Checkboxes", R, ""), ("Data scope", "Select", R, "All · Own class · Own child · Self"),
  ]),
  ("Audit Log", "List", "Admin, Principal", 3, [
   ("Date & time", "Column", O, ""), ("User", "Column", O, ""), ("Action", "Column", O, ""), ("Record", "Column", O, ""),
   ("Old → new value", "Column", O, ""), ("IP address", "Column", O, ""), ("Export", "Action", O, "Enterprise"),
  ]),
  ("School Settings", "Form", "Admin", 1, [
   ("School name & address", "Text", R, ""), ("Affiliation no.", "Text", O, ""), ("Current academic year", "Select", R, ""),
   ("Receipt / invoice prefixes", "Text", R, ""), ("Time zone & currency", "Select", R, ""), ("SMS / WhatsApp sender ID", "Text", O, ""),
  ]),
  ("Appearance & Branding", "Form + live preview", "Admin", 1, [
   ("Layout template", "Cards", R, "Classic · Bright · Top nav · Compact · Primary school"), ("Brand colour", "Swatches / hex", R, "Auto-darkened if hard to read"),
   ("Menu colour", "Select", O, "Dark · Brand · Light"), ("Corners", "Select", O, ""), ("Density", "Select", O, ""),
   ("Font", "Select", O, "Noto Sans covers Indian scripts"), ("Logo & login photo", "File", O, ""), ("Use on printed documents", "Toggle", O, ""),
   ("Publish / roll back", "Action", O, "Versioned"),
  ]),
 ]),
 ("10", "My Space", "Self-service for every signed-in person.", [
  ("My Profile", "Form", "Everyone", 1, [
   ("Name, photo, contact", "Text", O, ""), ("Change password", "Action", O, ""),
   ("Preferences", "Select", O, "Light · Dark · High contrast · Text size · Language"),
  ]),
  ("My Child", "Overview", "Parent", 1, [
   ("Child switcher", "Select", O, "For parents with more than one child"), ("Attendance", "Tile", O, ""), ("Class teacher", "Tile", O, ""), ("Notices", "List", O, ""),
  ]),
  ("Fee Dues & Pay", "List + pay", "Parent, Student", 1, [
   ("Invoice / period", "Column", O, ""), ("Due date", "Column", O, ""), ("Amount", "Column", O, ""),
   ("Pay now", "Action", O, "Online gateway (Professional+)"), ("Receipts", "Download", O, ""),
  ]),
  ("My Payslips", "List", "All staff", 2, [
   ("Month", "Column", O, ""), ("Net pay", "Column", O, ""), ("Download PDF", "Action", O, ""),
  ]),
 ]),
]

CONSOLE = [
 ("Schools", "List of schools with plan, students, status (Trial · Active · Suspended) and renewal date"),
 ("Plan & features", "Plan selector plus on / off switches for every module, sub-menu and function; add-ons and trials"),
 ("Limits", "Students, staff logins, storage, SMS credits, campuses, custom reports — per plan with overrides"),
 ("Billing", "Price per student, minimum, add-ons, usage charges, invoices"),
 ("Branding", "Theme the school starts with; white-label app (Enterprise)"),
 ("Power BI reports", "Report catalog per Insights tab, workspace and report IDs"),
 ("Change history", "Every switch, plan change and import, with who and when"),
]

ROLES = ["Admin", "Principal", "Accountant", "Teacher", "Front Office", "Parent"]
MATRIX = [
 ("Dashboard", ["Full", "Full", "Full", "Own view", "Own view", "Own view"]),
 ("Students", ["Full", "View", "View", "Own class", "Admit · edit", "Own child"]),
 ("Staff", ["Full", "Approve leave", "View", "Self · leave", "—", "—"]),
 ("Academics", ["Full", "View", "—", "View syllabus", "—", "—"]),
 ("Exams", ["Full", "Approve papers", "—", "Build papers · grades", "—", "—"]),
 ("Fees", ["Full", "Approve", "Full", "—", "Collect", "Pay own"]),
 ("Payroll", ["Full", "Approve", "Full", "Own slip", "Own slip", "—"]),
 ("Accounts", ["Full", "View reports", "Full", "—", "—", "—"]),
 ("Operations", ["Full", "Audit log", "—", "—", "—", "—"]),
]

# ------------------------------- PART B -----------------------------------
AWS_MAP = [
 ("AWS account in an Organization", "School (tenant)", "Every school gets its own ID, web address (school.yourapp.com) and isolated data."),
 ("CloudFormation template", "School Blueprint", "One file describes the whole school setup; the platform builds it the same way every time."),
 ("Launch wizard", "Onboarding wizard", "Step-by-step screens in the Platform Console that fill in the Blueprint for you."),
 ("Change set / plan preview", "Preview before apply", "Shows exactly what will be created or changed before anything happens."),
 ("Service catalog & feature flags", "Plans and feature switches", "Modules, sub-menus and functions are switched on by plan, add-on or trial."),
 ("IAM roles & policies", "Roles & data scope", "Who can view, create, edit, delete or approve — and whose records they see."),
 ("Regions", "Data region", "Data stays in the chosen region (for example ap-south-1, Mumbai)."),
 ("Accounts for dev / staging / prod", "Pre-production and production", "The school checks everything in pre-production; going live needs approval."),
 ("CloudTrail", "Change history & audit log", "Every configuration change and data import is recorded with who and when."),
]

STAGES = [
 ("1", "Agree plan", "Sales / school management", "Plan by enrolment size, add-ons, start date, data region", "Signed order form", "Day 0"),
 ("2", "Provision", "Platform (automatic)", "School ID, web address, database rows with school-level security, file storage, sign-in, default theme", "Empty school in pre-production", "Minutes"),
 ("3", "Configure", "Onboarding lead + school admin", "Board, classes and sections, fee heads and amounts, roles, features, branding — in the wizard or the Blueprint", "Approved Blueprint", "1–3 days"),
 ("4", "Import data", "School office + data specialist", "Fill the Excel templates; upload; the platform checks every row", "Clean import, error report cleared", "2–5 days"),
 ("5", "Reconcile", "Accountant + Principal", "Student count by class, fee dues by student, opening bank and cash balances match the school's records", "Signed reconciliation", "1–2 days"),
 ("6", "Test (UAT)", "School staff", "Try admission, fee collection, attendance, a paper, payroll in pre-production", "UAT sign-off", "2–5 days"),
 ("7", "Go live", "Platform (on approval)", "Promote to production, send invites to staff and parents, switch web address", "Live school", "1 day"),
 ("8", "Hypercare", "Support team", "Daily check-ins, quick fixes, training sessions", "Handover to normal support", "30 days"),
]

BLUEPRINT = """apiVersion: school-platform/v1
kind: SchoolBlueprint
metadata:
  code: GVS
  name: Green Valley School
spec:
  tenant:
    subdomain: greenvalley          # greenvalley.yourapp.com
    region: ap-south-1              # Mumbai
    hosting: pooled                 # dedicated for Enterprise
  subscription:
    plan: PROFESSIONAL              # 501 - 1,000 students
    billing: annual
    contractedStudents: 800
    startsOn: 2027-04-01
    addOns: [FN_BANK_RECON]         # one tier up, sold separately
    switchedOff: [FN_WHATSAPP]      # school opted out
  academics:
    board: CBSE
    academicYear: { name: 2027-28, start: 2027-04-01, end: 2028-03-31 }
    classes:
      - { grade: 1,  sections: [A, B],    capacity: 35 }
      - { grade: 10, sections: [A, B, C], capacity: 40 }
  fees:
    receiptPrefix: GVS-R
    heads:
      - { name: Tuition,   frequency: monthly,  account: "4000" }
      - { name: Transport, frequency: monthly,  account: "4010" }
      - { name: Admission, frequency: one-time, account: "4020" }
  roles:
    useDefaults: true
    custom:
      - name: Exam Cell
        allow: [EXM_APPROVED:view+print, EXM_QP:view]
  appearance: { template: CLASSIC, brandColor: "#0F766E", font: NOTO_SANS }
  imports:                          # files from section B4, loaded in this order
    - 01_classes_sections.xlsx
    - 02_staff.xlsx
    - 03_students_guardians.xlsx
    - 04_fee_structure.xlsx
    - 05_opening_fee_dues.xlsx
    - 06_salary_structure.xlsx
    - 07_opening_balances.xlsx"""

BLUEPRINT_STEPS = [
 ("Validate", "Checks the file: required parts present, plan allows every feature asked for, classes and fee heads make sense."),
 ("Preview", "Lists what will be created: 26 sections, 3 fee heads, 1 custom role, 7 imports — nothing is changed yet."),
 ("Apply to pre-production", "Builds the school in pre-production and runs the imports there."),
 ("Approve & promote", "After UAT sign-off, the Principal approves and the same Blueprint is applied to production."),
 ("Re-use", "Next year (or a new branch) starts from a copy of this Blueprint."),
]

# Import templates: (file, purpose, depends on, [(column, required, format / rule, example)])
IMPORTS = [
 ("01_classes_sections.xlsx", "Classes, sections and class teachers", "—", [
  ("class_name", True, "Text; must match the board's grades", "Grade 10"),
  ("section", True, "Text, 1–3 characters", "A"),
  ("capacity", False, "Whole number", "40"),
  ("class_teacher_employee_code", False, "Must exist in 02_staff (can be filled after)", "EMP-0187"),
 ]),
 ("02_staff.xlsx", "All staff, with login and salary details", "—", [
  ("employee_code", True, "Unique in the school", "EMP-0187"),
  ("first_name / last_name", True, "Text", "Priya / Rao"),
  ("mobile", True, "10-digit Indian mobile (+91 added)", "9876543210"),
  ("email", True, "Valid email; used for the login invite", "priya.rao@school.edu"),
  ("department / designation", True, "Must be in the school's lists (new ones created on confirm)", "Science / TGT"),
  ("employment_type", True, "Permanent · Contract · Part-time", "Permanent"),
  ("joining_date", True, "DD-MM-YYYY", "16-11-2026"),
  ("roles", False, "Comma list: Teacher, Accountant, Front Office …", "Teacher"),
  ("bank_account / ifsc / pan", False, "Encrypted on upload; checked for format", "—"),
 ]),
 ("03_students_guardians.xlsx", "Students with primary guardian and current class", "01", [
  ("admission_no", True, "Unique in the school", "ADM-2025-0231"),
  ("first_name / last_name", True, "Text", "Aarav / Sharma"),
  ("date_of_birth", True, "DD-MM-YYYY; age must suit the class", "14-05-2015"),
  ("gender", True, "Male · Female · Other", "Male"),
  ("class / section / roll_no", True, "Class and section must exist in 01", "Grade 6 / A / 12"),
  ("admission_date", True, "DD-MM-YYYY", "01-04-2021"),
  ("guardian_name / relation", True, "Text; Father · Mother · Guardian", "Rohit Sharma / Father"),
  ("guardian_mobile", True, "10-digit mobile; siblings sharing a mobile are linked to one guardian", "9812344410"),
  ("guardian_email", False, "Valid email", "—"),
  ("transport_route / stop", False, "Must exist in transport setup", "Route 3 / Lake View"),
  ("concession", False, "Sibling · Staff ward · Merit", "Sibling"),
  ("parent_app_login", False, "Yes / No (default Yes)", "Yes"),
 ]),
 ("04_fee_structure.xlsx", "Fee amounts by class and fee head", "01", [
  ("academic_year", True, "Must be the year being set up", "2027-28"),
  ("class", True, "Must exist in 01", "Grade 6"),
  ("fee_head", True, "Must be a fee head in the Blueprint", "Tuition"),
  ("frequency", True, "One-time · Monthly · Term · Annual", "Monthly"),
  ("amount", True, "Number ≥ 0, no ₹ sign", "6200"),
  ("due_day", False, "1–28", "10"),
 ]),
 ("05_opening_fee_dues.xlsx", "Unpaid amounts carried over from the old system", "03, 04", [
  ("admission_no", True, "Must exist in 03", "ADM-2025-0231"),
  ("period", True, "Text shown on the invoice", "Mar 2027"),
  ("fee_head", True, "Must exist", "Tuition"),
  ("amount_due", True, "Number > 0", "4000"),
  ("due_date", True, "DD-MM-YYYY", "31-03-2027"),
 ]),
 ("06_salary_structure.xlsx", "Salary components per staff member", "02", [
  ("employee_code", True, "Must exist in 02", "EMP-0187"),
  ("component", True, "Basic, HRA, DA, PF, tax … (from the component list)", "Basic"),
  ("amount", True, "Number ≥ 0 per month", "40000"),
  ("effective_from", True, "DD-MM-YYYY", "01-04-2027"),
 ]),
 ("07_opening_balances.xlsx", "Opening balances for the accounts module", "Professional+", [
  ("account_code", True, "From the chart of accounts", "1010"),
  ("account_name", False, "For checking only", "Bank Account"),
  ("opening_balance", True, "Debit positive, credit negative; total must be zero", "4862400"),
  ("as_on_date", True, "Day before go-live", "31-03-2027"),
 ]),
 ("08_question_bank.xlsx (optional)", "Existing questions the school owns", "Board & textbook link", [
  ("class / subject / chapter_no / topic", True, "Must match the linked textbook", "10 / Maths / 4 / Nature of roots"),
  ("type / marks", True, "MCQ · A–R · VSA · SA · LA · Case; number", "MCQ / 1"),
  ("difficulty", True, "Easy · Intermediate · Tough", "Intermediate"),
  ("question / options / answer", True, "Text; options separated by |", "—"),
  ("competency_based", False, "Yes / No", "Yes"),
 ]),
]

CHECKS = [
 ("Duplicates", "Two rows with the same admission no., employee code or receipt no. are rejected; possible duplicates by name + date of birth are flagged."),
 ("Links", "Every class, section, fee head, account and employee code referred to must exist (or be in an earlier file)."),
 ("Formats", "Dates DD-MM-YYYY, 10-digit mobiles, valid emails, amounts as plain numbers."),
 ("Sense checks", "Age suits the class; section not over capacity; fee amount not zero; opening balances add up to zero."),
 ("Limits", "Total students and staff logins within the plan — if over, the import pauses and suggests the next plan."),
 ("Privacy", "Bank account and tax ID numbers are encrypted on upload; files are deleted from the staging area after import."),
]

ERRORS = [
 ("03_students", "47", "class", "Grade 6", "Section 6-D does not exist", "Add 6-D to file 01 or correct the section"),
 ("03_students", "112", "guardian_mobile", "98123", "Not a 10-digit mobile", "Enter the full number"),
 ("03_students", "205", "date_of_birth", "31-02-2014", "Not a real date", "Check the birth certificate"),
 ("05_opening_fee_dues", "18", "admission_no", "ADM-2024-0999", "Student not found in file 03", "Add the student or remove the row"),
 ("07_opening_balances", "—", "total", "1,250", "Debits and credits differ by ₹1,250", "Check suspense / rounding entries"),
]

TIMELINE = [
 ("Starter", "Up to 250", "Wizard only, presets", "3–5 working days"),
 ("Growth", "251 – 500", "Wizard + imports", "1–2 weeks"),
 ("Professional", "501 – 1,000", "Blueprint + imports + accounts", "2–3 weeks"),
 ("Enterprise", "1,000+", "Blueprint, multi-campus, dedicated database option, SSO", "4–6 weeks"),
]

RACI = [
 ("Agree plan & sign order", "Principal / management", "Your sales lead"),
 ("Fill Blueprint / wizard", "School admin", "Onboarding lead"),
 ("Prepare import files", "Office staff, accountant", "Data specialist (templates, cleaning help)"),
 ("Fix import errors", "Office staff", "Data specialist"),
 ("Reconcile students, dues, balances", "Accountant, Principal", "Data specialist"),
 ("UAT and sign-off", "Principal + key staff", "Onboarding lead"),
 ("Go-live approval", "Principal", "Platform team promotes to production"),
 ("Training", "All staff", "Onboarding lead (role-wise sessions)"),
]

GOLIVE = [
 "Plan, add-ons and data region confirmed in the Platform Console",
 "Board, classes, sections and subjects match the school's timetable",
 "Fee structure and opening dues reconciled; accountant signed",
 "Opening bank and cash balances entered and agreed (Professional+)",
 "Staff logins tested for each role; parent app invite text approved",
 "Receipt, invoice and paper headers show the right logo and name",
 "Backups and the rollback point for go-live recorded",
 "Principal approval recorded; production web address switched",
]
