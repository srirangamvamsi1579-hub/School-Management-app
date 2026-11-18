# User Guide — School Management Platform

For schools, parents and our support team. It covers every menu and sub-menu, what each role sees on the website and in the mobile app, and step-by-step demos of the main workflows. Shareable doc version with screenshots: https://claude.ai/artifact/6ALh8LqsnVisEpf9Leq1LL. The same guide is inside the app: **Help → User Guide & Demo**, where every demo runs with a guide bar that signs you in as the right person.

## 1. Getting started

| What | Where |
| --- | --- |
| Website (test build) | https://srirangamvamsi1579-hub.github.io/School-Management-app/ |
| User guide with live demos (no sign-in) | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/p/guide |
| Mobile app preview (school code **GVS**) | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/p/mobile |
| Public admission form | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/p/apply |
| Any screen directly | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/s/<CODE>, e.g. #/s/SELF_REQUESTS |

**Demo accounts** — password for all: `Demo@123`. On the sign-in page, *Demo quick access* signs in without a password.

| Person | Sign-in |
| --- | --- |
| Admin user (Admin) | admin@greenvalley.example.in |
| Dr. Kavita Menon (Principal) | principal@greenvalley.example.in |
| Sana Khan (Accountant) | sana.accounts@example.com |
| Sonia Mehta (Teacher, class coordinator 8-A) | sonia.teacher@example.com |
| Anita Rao (Front Office) | 9845011200 |
| Rohit Sharma (Parent of Aarav, 8-A) | rohit.s@example.com |
| Meera Iyer (Teacher + Vice Principal) | meera.vp@example.com |
| Platform support (our company) | support@yourapp.example.com |
| Manjunath Gowda (Transport In-charge) | transport@greenvalley.example.in |
| Murali Krishnan (Teacher + Head of Teaching Staff) | murali.hots@example.com |

**Good to know**

- Emails and SMS are simulated: read them in Operations → Email & SMS Outbox, or the Test inbox on the sign-in page.
- Data stays in your browser; two tabs stay in step. Admins can reset it (Operations → Reset demo data).
- A school sees only the modules in its plan (Starter, Growth, Professional, Enterprise) or switched on for it. A person sees only the screens their role, designation or personal grants allow.

## 2. What each role sees

Website menus and phone tabs with the recommended layout. Schools change this in **Operations → Web & App Screens** (section 3).

| Role | Website (main menus and sub-menus) | Phone app tabs |
| --- | --- | --- |
| **Parent** | **Dashboard:** Dashboard<br>**Academics:** Timetable<br>**My Space:** My Child, Requests to School, Fee Dues & Pay, My Account, My Preferences<br>**Help:** User Guide & Demo | Home, Requests, Fees, My child, Account |
| **Teacher** | **Dashboard:** Dashboard<br>**Students:** All Students, Attendance, Coordinator Desk, Parent Meetings<br>**Staff:** Leave Requests<br>**Academics:** Boards, Syllabus & Textbooks, Timetable<br>**Exams:** Question Papers, Approved Papers, Question Bank, Co-Scholastic Grades, Assessment Profiles<br>**Data Analytics:** Top & Bottom Performers<br>**Operations:** Templates<br>**My Space:** My Payslips, My Account, My Preferences<br>**Help:** User Guide & Demo | Home, Timetable, Attendance, Approvals, Meetings, Account |
| **Front Office** | **Dashboard:** Dashboard<br>**Students:** All Students, Admissions & Enquiries, New Admission, Office Requests, Gate Desk, Documents & ID Cards<br>**Fees:** Collect Fee, Dues & Reminders, Receipts<br>**Transport:** Pickup & Drop Changes<br>**Data Analytics:** Admissions Funnel<br>**Operations:** Templates<br>**My Space:** My Payslips, My Account, My Preferences<br>**Help:** User Guide & Demo | Home, Gate, Office, Bus changes, Account |
| **Transport team** | **Transport:** Daily Bus Manifest, Driver Route Sheets, Pickup & Drop Changes, Routes, Stops & Timings<br>**Data Analytics:** Transport Reports<br>**My Space:** My Account, My Preferences<br>**Help:** User Guide & Demo | Home, Route sheet, Manifest, Bus changes, Account |
| **Principal** | **Dashboard:** Dashboard<br>**Students:** Insights, All Students, Admissions & Enquiries, Attendance, Coordinator Desk, Parent Meetings, Office Requests<br>**Staff:** Insights, All Staff, Staff Attendance, Leave Requests<br>**Academics:** Classes & Sections, Class Coordinators, Boards, Syllabus & Textbooks, Timetable<br>**Exams:** Question Papers, Approved Papers, Question Bank, Paper Formats, Co-Scholastic Grades, Assessment Profiles<br>**Fees:** Insights, Fee Request Emails, Payment Matching, Dues & Reminders, Fee Structure, Concessions<br>**Transport:** Daily Bus Manifest, Driver Route Sheets, Pickup & Drop Changes, Routes, Stops & Timings<br>**Data Analytics:** Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel<br>**Payroll:** Run Payroll, Payslips<br>**Accounts:** Bank & Payment Details, Account Statement, Income & Expenses<br>**Operations:** Templates, Web & App Screens<br>**My Space:** My Payslips, My Account, My Preferences<br>**Help:** User Guide & Demo | Home, Attendance, Approvals, Meetings, Office, Route sheet, Account |
| **Accountant** | **Dashboard:** Dashboard<br>**Students:** All Students<br>**Staff:** All Staff<br>**Fees:** Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions<br>**Data Analytics:** Report Catalogue, Transport Reports<br>**Payroll:** Run Payroll, Payslips<br>**Accounts:** Bank & Payment Details, Account Statement, Income & Expenses<br>**Operations:** Templates, Email & SMS Outbox<br>**My Space:** My Payslips, My Account, My Preferences<br>**Help:** User Guide & Demo | Home, Payslips, Account |
| **Admin** | **Dashboard:** Dashboard<br>**Students:** Insights, All Students, Admissions & Enquiries, New Admission, Attendance, Coordinator Desk, Parent Meetings, Office Requests, Gate Desk, Promote / Transfer, Documents & ID Cards<br>**Staff:** Insights, All Staff, Add Staff, Staff Attendance, Leave Requests<br>**Academics:** Classes & Sections, Class Coordinators, Boards, Syllabus & Textbooks, Timetable<br>**Exams:** Question Papers, Approved Papers, Question Bank, Paper Formats, Co-Scholastic Grades, Assessment Profiles<br>**Fees:** Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions<br>**Transport:** Daily Bus Manifest, Driver Route Sheets, Pickup & Drop Changes, Routes, Stops & Timings<br>**Data Analytics:** Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel<br>**Payroll:** Run Payroll, Payslips<br>**Accounts:** Bank & Payment Details, Account Statement, Income & Expenses<br>**Operations:** Users, Roles & Permissions, Templates, Data Import, Web & App Screens, Appearance & Branding, Website & Links, Email & SMS Outbox, SMS Gateway<br>**My Space:** My Payslips, My Account, My Preferences<br>**View as Profile:** Parent, Teacher (class coordinator), Teacher + Vice Principal, Teacher + Head of Teaching Staff, Principal, Accountant, Front Office, Transport team<br>**Help:** User Guide & Demo | Home, Account |
| **Platform team** | **Operations:** Web & App Screens<br>**Platform Console:** Schools & Plans<br>**Help:** User Guide & Demo | Website only |

## 3. Web & App Screens (choosing what goes on the website and in the app)

**Operations → Web & App Screens.** For each role, each phone-ready screen is set to *Website + app*, *Website only* or *App only*. Screens not built for phones always stay on the website. Account is always on both, because the app stores require account deletion inside the app.

**Workflow**

1. **Edit a draft** (Admin or platform team): pick a role and change where screens show. The preview shows that role's website menu and phone tabs. Nothing changes for users yet.
2. **Send for approval** with a note. The Principal is emailed. The draft is locked while it waits; the editor can take it back.
3. **Approve and publish** (Principal or platform team — a different person from the editor), or **Send back** with a reason.
4. Published layouts are numbered versions. **History** shows who changed what; *Restore as draft* brings an earlier version back through the same approval.

Who can open a screen is still set in Roles & Permissions; this only decides where it shows. Designations and personal grants follow the role's choice.

**Recommended layout (version 1)** — chosen so most roles fit the 5-tab phone bar:

| Phone-ready screen | Parent | Teacher | Front Office | Transport team | Principal | Accountant | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Requests to School | Website + app | — | — | — | — | — | — |
| Fee Dues & Pay | Website + app | — | — | — | — | — | — |
| My Child | Website + app | — | — | — | — | — | — |
| Timetable | Website only | Website + app | — | — | Website only | — | Website only |
| Attendance | — | Website + app | — | — | Website + app | — | Website only |
| Coordinator Desk | — | Website + app | — | — | Website + app | — | Website only |
| Parent Meetings | — | Website + app | — | — | Website + app | — | Website only |
| Gate Desk | — | — | Website + app | — | — | — | Website only |
| Office Requests | — | — | Website + app | — | Website + app | — | Website only |
| Driver Route Sheets | — | — | — | Website + app | Website + app | — | Website only |
| Daily Bus Manifest | — | — | — | Website + app | Website only | — | Website only |
| Pickup & Drop Changes | — | — | Website + app | Website + app | Website only | — | Website only |
| Leave Requests | — | Website only | — | — | Website only | — | Website only |
| My Payslips | — | Website only | Website only | — | Website only | Website + app | Website only |
| My Account | Website + app | Website + app | Website + app | Website + app | Website + app | Website + app | Website + app |

"—" means the role cannot open the screen at all.

## 4. Guided demos

In the app: **Help → User Guide & Demo → Guided demos → Start**. Each step names the person and the screen; the guide bar signs you in and opens it.

### 4.1 Parent leave request → coordinator → attendance and bus

*Parent, Teacher (coordinator), Transport · about 3 min*

1. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Click "Leave (child will be absent)". Choose Aarav, tomorrow to the day after, reason "Family function". Send request.  
   *You should see:* Status: Waiting for coordinator.
2. **Sonia Mehta (Teacher, class coordinator 8-A) → Coordinator Desk:** Sonia coordinates 8-A. Find Aarav’s leave and click Approve.  
   *You should see:* Status Approved; the parent is emailed.
3. **Sonia Mehta (Teacher, class coordinator 8-A) → Attendance:** Open 8-A attendance for tomorrow’s date (if the date picker shows today, that’s fine — leave appears on the leave days).  
   *You should see:* Aarav shows "On leave (approved)".
4. **Manjunath Gowda (Transport In-charge) → Driver Route Sheets:** Pick tomorrow and Aarav’s route.  
   *You should see:* Aarav is marked ✗ — On leave; the driver does not wait.
5. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Back as the parent.  
   *You should see:* The leave shows Approved.

### 4.2 Early leave with a gate code

*Parent, Coordinator, Front Office, Transport · about 3 min*

1. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Click "Early leave". Today (or tomorrow), time 12:30, collected by Rohit Sharma, reason "Doctor". Send.  
   *You should see:* Waiting for coordinator.
2. **Sonia Mehta (Teacher, class coordinator 8-A) → Coordinator Desk:** Approve the early leave.  
   *You should see:* A 4-digit gate code is created and sent to the parent.
3. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Note the gate code in the Gate code column.  
   *You should see:* Code shown only to the parent.
4. **Anita Rao (Front Office) → Gate Desk:** Find Aarav, check ID, type the gate code, Hand over. (Only works on the request’s date.)  
   *You should see:* Handed over with the time.
5. **Manjunath Gowda (Transport In-charge) → Daily Bus Manifest:** Afternoon trip for that day.  
   *You should see:* Aarav: Not boarding — left early with Rohit Sharma.

### 4.3 Late arrival: parent drops the child

*Parent, Front Office, Teacher · about 2 min*

1. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Click "Late arrival". Today, arriving at a time later today (after 08:45, before 15:00). Send.  
   *You should see:* Confirmed at once.
2. **Anita Rao (Front Office) → Gate Desk:** Under "Expected late arrivals today", click Arrived when the child comes in.  
   *You should see:* Coordinators are told.
3. **Sonia Mehta (Teacher, class coordinator 8-A) → Attendance:** Open 8-A attendance for today.  
   *You should see:* Aarav shows "Late — dropped by parent".

### 4.4 Parent asks to meet a teacher

*Parent, Teacher · about 2 min*

1. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Click "Meet or call a teacher". Pick Sonia Mehta, Phone call, preferred date and time, topic "Maths homework". Send.  
   *You should see:* Waiting for teacher.
2. **Sonia Mehta (Teacher, class coordinator 8-A) → Parent Meetings:** Click Reply on the request; pick a date and time → Confirm time.  
   *You should see:* Confirmed; the parent is emailed.
3. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Back as the parent.  
   *You should see:* Shows Confirmed with the date and time.

### 4.5 Certificate request to the office

*Parent, Front Office · about 1 min*

1. **Rohit Sharma (Parent of Aarav, 8-A) → Requests to School:** Click "Other request". Bonafide / study certificate, needed by next week, details "Passport". Send.  
   *You should see:* With the office.
2. **Anita Rao (Front Office) → Office Requests:** Update → message "Ready at the office after 2 pm" → Mark done.  
   *You should see:* The parent sees Done with the message.

### 4.6 Website enquiry → enrolled student

*Public visitor, Front Office, Principal · about 4 min*

1. **Without signing in → #/p/apply:** Open the public admission form (new tab, no sign-in). Fill child, date of birth, parent, mobile; tick consent; Send enquiry.  
   *You should see:* A reference number is shown.
2. **Anita Rao (Front Office) → Admissions & Enquiries:** Applications tab: find the new enquiry. Move it to Submitted (add documents), In review, Offered.  
   *You should see:* Each move emails the parent.
3. **Anita Rao (Front Office) → Admissions & Enquiries:** Move it to Enrolled.  
   *You should see:* A student is created with an admission number.
4. **Dr. Kavita Menon (Principal) → Admissions Funnel:** Look at the funnel by grade and source.  
   *You should see:* Website enquiries counted.

### 4.7 Fee request → online payment → automatic matching

*Accountant, Parent · about 4 min*

1. **Sana Khan (Accountant) → Fee Request Emails:** Choose Grade VIII → Preview → Send.  
   *You should see:* Emails in the outbox, one per guardian, each with a pay link.
2. **Rohit Sharma (Parent of Aarav, 8-A) → Fee Dues & Pay:** Pay online (simulated).  
   *You should see:* Receipt and confirmation email.
3. **Sana Khan (Accountant) → Payment Matching:** See the payment matched automatically. Use "Simulate" to try a bank line with only the admission number in the narration.  
   *You should see:* Matched by narration; duplicates flagged.
4. **Sana Khan (Accountant) → Receipts:** Open the new receipt.  
   *You should see:* In the school’s receipt format.

### 4.8 Question paper: generate → approve → print

*Teacher, Principal · about 3 min*

1. **Sonia Mehta (Teacher, class coordinator 8-A) → Question Papers:** Pick a format and chapters, set the difficulty mix → Generate → Send for approval.  
   *You should see:* Sets A, B and C with no repeated question.
2. **Dr. Kavita Menon (Principal) → Question Papers:** Open the paper → Approve & lock.  
   *You should see:* Locked; moves to Approved Papers.
3. **Sonia Mehta (Teacher, class coordinator 8-A) → Approved Papers:** Open it → Print.  
   *You should see:* Print logged.

### 4.9 Monthly payroll

*Accountant, Teacher · about 2 min*

1. **Sana Khan (Accountant) → Run Payroll:** Pick the month → check figures → Approve → Post.  
   *You should see:* Voucher posted to accounts.
2. **Sonia Mehta (Teacher, class coordinator 8-A) → My Payslips:** Open the payslip.  
   *You should see:* Shows basic, allowances, PF, TDS and net.

### 4.10 New account from the app → approval in Users

*Parent or staff (new), Admin · about 3 min*

1. **Without signing in → #/p/mobile:** Phone app → school code GVS → Create an account. Pick Parent (give the child’s admission number) or a staff role — e.g. Transport team → designation Driver. Verify the code (shown on screen), set a password.  
   *You should see:* Account created, waiting for approval; details emailed (never the password).
2. **Admin user (Admin) → Users:** The new account is at the top as “Waiting for approval”. Review → the role asked for is filled in and the designation list shows only that role’s designations → status Active → Save.  
   *You should see:* The person can now sign in.

### 4.11 Add a user: designations follow the role

*Admin · about 2 min*

1. **Admin user (Admin) → Users:** Add user → Role Transport team: the designations are Transport In-charge, Transport Supervisor, Driver, Cleaner, Bus Helper / Attendant. Change the role to Parent: the designation is simply Parent.  
   *You should see:* Each role offers only its own designations.
2. **Admin user (Admin) → Roles & Permissions:** User management → Transport team (department Transport) → add the designation “Route Marshal”.  
   *You should see:* It is offered next time a Transport user is added.

### 4.12 See the app as each profile (Admin)

*Admin · about 2 min*

1. **Admin user (Admin) → undefined:** Main menu → View as Profile → Parent (the same items are in the side menu).  
   *You should see:* The menus change to the parent’s; a bar says who you are viewing as.
2. **Admin user (Admin) → undefined:** In the bar, switch to Phone app, then Back to Admin.  
   *You should see:* The parent’s phone tabs; changes are blocked unless you tick “Act as this person”.

### 4.13 Choose what shows on the website and in the app

*Admin, Principal · about 3 min*

1. **Admin user (Admin) → Web & App Screens:** Role Teacher → Leave Requests → "Website + app". Role Front Office → Gate Desk → "App only".  
   *You should see:* A draft starts; the preview shows the new phone tabs and website menu.
2. **Admin user (Admin) → Web & App Screens:** Send for approval with a note.  
   *You should see:* Status: Waiting for approval; the Principal is emailed.
3. **Dr. Kavita Menon (Principal) → Web & App Screens:** Check "What the draft changes" → Approve and publish.  
   *You should see:* Published as a new version; history kept.
4. **Anita Rao (Front Office) → Office Requests:** As Front Office on the website.  
   *You should see:* Gate Desk is gone from the website menu (it is app only now).
5. **Without signing in → #/p/mobile:** Open the phone preview, school code GVS, demo account Anita Rao.  
   *You should see:* Gate is a tab in the app.

### 4.14 Onboard a school (platform team)

*Platform team, Admin · about 3 min*

1. **Platform support (our company) → Schools & Plans:** Pick a school → plan → switch modules, sub-menus and functions → switch the mobile app on.  
   *You should see:* Only those menus appear for that school.
2. **Platform support (our company) → Web & App Screens:** Start from recommended → adjust → Send for approval (the platform team can approve too, but a different person must).  
   *You should see:* Draft waiting for approval.
3. **Admin user (Admin) → Website & Links:** Copy the deep links and the admission-form snippet for the school website.  
   *You should see:* Each school has its own addresses.

### 4.15 A day for the transport team

*Transport · about 3 min*

1. **Manjunath Gowda (Transport In-charge) → Routes, Stops & Timings:** Open a route; change a stop time.  
   *You should see:* Times checked for order.
2. **Manjunath Gowda (Transport In-charge) → Driver Route Sheets:** Pick the day → What the driver sees → Send to all drivers.  
   *You should see:* Each driver gets only their route.
3. **Manjunath Gowda (Transport In-charge) → Daily Bus Manifest:** Morning trip; mark Boarded / No-show.  
   *You should see:* Not-boarding children show the reason.

### 4.16 Results and teacher performance

*Principal, Head of Teaching Staff, Teacher · about 2 min*

1. **Dr. Kavita Menon (Principal) → Top & Bottom Performers:** Grade IX, all sections; then pick two sections.  
   *You should see:* Top 6 and bottom 6 change.
2. **Murali Krishnan (Teacher + Head of Teaching Staff) → Teacher Performance:** Switch "Share with teachers" on.  
   *You should see:* Teachers get My Teaching Performance (view only).
3. **Sonia Mehta (Teacher, class coordinator 8-A) → My Teaching Performance:** As a teacher.  
   *You should see:* Only her own subjects and sections.

## 5. Every menu explained

### 5.1 Dashboard

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Dashboard** | Your home page: the numbers and to-dos that matter for your role. | Check the cards each morning; click a needs-attention item to open it. | Parent, Teacher, Front Office, Principal, Accountant, Admin | Website |

### 5.2 Students

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Insights** <br>*Growth+* | Student numbers, attendance and fee trends (Power BI). | Use the grade and month filters; export from the report menu. | Principal, Admin | Website |
| **All Students** | Every student with class, guardian and transport. | Search by name or admission number; click a student to open the profile. | Teacher, Front Office, Principal, Accountant, Admin | Website |
| **Admissions & Enquiries** | Enquiries and applications for next year, from first call to enrolment, with a summary by grade. | Add an enquiry or application form; move it Submitted → In review → Offered → Enrolled, or Opted out with a reason. Website enquiries arrive here automatically. | Front Office, Principal, Admin | Website |
| **New Admission** | Admit a student directly (without the enquiry pipeline). | Fill child, class-section, guardian and transport; the admission number is generated. | Front Office, Admin | Website |
| **Attendance** | Daily class attendance. | Pick the class; tap a student to switch Present / Absent. Leave (approved) and Late (dropped by parent) come in from parent requests. | Teacher, Principal, Admin | Website; app for Teacher, Principal |
| **Coordinator Desk** | Coordinator Desk: leave, early-leave, pickup, drop and transport requests for the sections you coordinate. | Approve or decline (a reason is needed); approving an early leave sends the parent a gate code. | Teacher, Principal, Admin | Website; app for Teacher, Principal |
| **Parent Meetings** | Parents asking to meet or call you. | Click Reply, pick a date and time (or decline with a note); the parent is told by email and in the app. | Teacher, Principal, Admin | Website; app for Teacher, Principal |
| **Office Requests** | Certificates, documents and queries sent by parents. | Open item → Update → Mark done with a message (e.g. "Ready at the office"), or decline. | Front Office, Principal, Admin | Website; app for Front Office, Principal |
| **Gate Desk** | Gate Desk: today’s collections and expected late arrivals; checking new pickup people. | Check photo ID, enter the 4-digit gate code, Hand over. For late arrivals press Arrived. "Approve pickup people" checks new collectors. | Front Office, Admin | Website; app for Front Office |
| **Promote / Transfer** <br>*Growth+* | Promote a class to the next year or transfer a student out. | Choose class and target; review the list; confirm. | Admin | Website |
| **Documents & ID Cards** | Documents and ID cards. | Upload or print certificates and ID cards from the school’s templates. | Front Office, Admin | Website |

### 5.3 Staff

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Insights** <br>*Growth+* | Staff numbers, attendance and leave trends. | Filter by department. | Principal, Admin | Website |
| **All Staff** | Every staff member. | Search; open a profile to edit. | Principal, Accountant, Admin | Website |
| **Add Staff** | Add a staff member. | Fill details; a set-password link is emailed if they get an account. | Admin | Website |
| **Staff Attendance** | Staff attendance. | Mark present / absent / on leave per day. | Principal, Admin | Website |
| **Leave Requests** | Staff leave requests. | Staff apply; the Principal approves or declines. | Teacher, Principal, Admin | Website (can be added to the app) |

### 5.4 Academics

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Classes & Sections** | Classes and sections with capacity. | Add sections; set capacity (used for admissions seats). | Principal, Admin | Website |
| **Class Coordinators** | Primary and secondary class coordinator for each section. | Pick two different teachers per section; they receive that section’s parent requests. | Principal, Admin | Website |
| **Boards, Syllabus & Textbooks** | Boards, textbooks, chapters and topics. | Pick the board and class; chapters feed question papers. | Teacher, Principal, Admin | Website |
| **Timetable** | Class and teacher timetables. | Click a cell to set subject and teacher; clashes are flagged. Parents see their child’s. | Parent, Teacher, Principal, Admin | Website; app for Teacher |

### 5.5 Exams

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Question Papers** | Generate question papers in board formats. | Pick format, chapters and difficulty mix → Generate Sets A/B/C → Send for approval. | Teacher, Principal, Admin | Website |
| **Approved Papers** | Approved, locked papers ready to print. | Open a paper → Print. | Teacher, Principal, Admin | Website |
| **Question Bank** | The question bank (Easy / Intermediate / Tough). | Add questions; new ones go to review before they can be used. | Teacher, Principal, Admin | Website |
| **Paper Formats** | Paper formats per board (sections, marks, time). | Copy a standard format and adjust. | Principal, Admin | Website |
| **Co-Scholastic Grades** | Co-scholastic grades (A/B/C). | Pick class and area; set grades. | Teacher, Principal, Admin | Website |
| **Assessment Profiles** | Assessment profiles and appreciation cards. | Write subject comments; print the profile. | Teacher, Principal, Admin | Website |

### 5.6 Fees

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Insights** <br>*Growth+* | Fee collection, dues and trends (Power BI). | Filter by grade and month. | Principal, Accountant, Admin | Website |
| **Collect Fee** | Take a fee payment at the counter. | Find the student, pick invoices, mode (cash / card / UPI), save; the receipt prints in the school’s format. | Front Office, Accountant, Admin | Website |
| **Fee Request Emails** | Send fee request emails by grade with a personal pay link. | Pick grades and instalment → Preview → Send. Parents without email get an SMS. | Principal, Accountant, Admin | Website |
| **Payment Matching** <br>*Growth+* | Match incoming bank / UPI / gateway payments to fee requests. | Most match automatically; for the rest pick the request and Match. Duplicates are flagged. | Principal, Accountant, Admin | Website |
| **Dues & Reminders** | Who owes what, with reminders. | Filter overdue; send reminders; open an invoice. | Front Office, Principal, Accountant, Admin | Website |
| **Receipts** | All receipts. | Search, reprint or email a receipt. | Front Office, Accountant, Admin | Website |
| **Fee Structure** | Fee heads and amounts per grade and instalment. | Edit heads and amounts for the year. | Principal, Accountant, Admin | Website |
| **Concessions** <br>*Growth+* | Concessions and scholarships. | Add a concession for a student; it applies to new invoices. | Principal, Accountant, Admin | Website |

### 5.7 Transport

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Daily Bus Manifest** | Daily bus manifest: who boards, who doesn’t and why, for morning and afternoon. | Pick date, trip and route. With attendant tracking on, mark Boarded / No-show. Send to transport team. | Transport team, Principal, Admin | Website; app for Transport team |
| **Driver Route Sheets** | One route sheet per driver with stop timings and who to wait for. | Pick the day → Send to all drivers (each gets only their route by SMS link) or Download all (Excel). | Transport team, Principal, Admin | Website; app for Transport team, Principal |
| **Pickup & Drop Changes** | Every request that changes the bus, today and coming days. | Read-only list for transport and front office. | Front Office, Transport team, Principal, Admin | Website; app for Front Office, Transport team |
| **Routes, Stops & Timings** | Routes, stops, bus, driver, attendant and stop times. | Edit stop times; they are checked for order and school times. | Transport team, Principal, Admin | Website |

### 5.8 Data Analytics (from the Growth plan)

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Report Catalogue** <br>*Growth+* | Catalogue of Power BI reports. | Open a report. | Principal, Accountant, Admin | Website |
| **Top & Bottom Performers** <br>*Growth+* | Top 6 and bottom 6 per grade. | Pick grade (and sections, term, subject). | Teacher, Principal, Admin | Website |
| **Transport Reports** <br>*Growth+* | Route use, cost per km, on-time and fee revenue. | Filter by grade. | Transport team, Principal, Accountant, Admin | Website |
| **Teacher Performance** <br>*Growth+* | How each teacher’s students are doing. | Filter by grade and subject. The Principal or Head of Teaching Staff can share it with teachers (view only). | Principal, Admin | Website |
| **Admissions Funnel** <br>*Growth+* | Admissions funnel and conversion. | Filter by grade and source. | Front Office, Principal, Admin | Website |

### 5.9 Payroll (from the Growth plan)

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Run Payroll** <br>*Growth+* | Monthly payroll. | Pick the month → check → Approve → Post to accounts; payslips are released. | Principal, Accountant, Admin | Website |
| **Payslips** <br>*Growth+* | All payslips. | Search and print. | Principal, Accountant, Admin | Website |

### 5.10 Accounts

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Bank & Payment Details** | The school’s bank and UPI details shown on invoices. | Edit; a second person (Principal) approves before it is used. | Principal, Accountant, Admin | Website |
| **Account Statement** <br>*Professional+* | Account statement with running balance. | Pick account and dates. | Principal, Accountant, Admin | Website |
| **Income & Expenses** <br>*Professional+* | Income and expenses. | Add expenses; see the summary. | Principal, Accountant, Admin | Website |

### 5.11 Operations

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Users** | Accounts: approve sign-ups, add users, change roles, designation, status, reset passwords, delete. | Add user or Review a sign-up → pick the role (the designation list then shows only that role’s designations; parents are simply Parent) → Active. | Admin | Website |
| **Roles & Permissions** | User management: profiles, departments and designations; add from the standard list for Indian schools or delete profiles. Permissions by department: No access, Read only or Full access for each main menu and sub-menu. Access summary: each person, their profile, department, designation and what they can open. | Permissions by department → pick a department → set a main menu (all its sub-menus) or expand it and set single sub-menus. Read only opens the screen but blocks saving. Access summary → filter by department or profile → Show access. | Admin | Website |
| **Templates** | Invoices, receipts, emails, payslips and letters in the school’s own format. | Use standard, Copy & edit, or Upload; set the default. | Teacher, Front Office, Principal, Accountant, Admin | Website |
| **Data Import** | Bring in data from Excel, CSV or photos. | Upload → map columns → map values → check → Import (can be rolled back). | Admin | Website |
| **Web & App Screens** | Which screens each role sees on the website, in the mobile app, or both. | Pick a role → choose Website + app / Website only / App only → Send for approval → the Principal approves → published. | Principal, Admin, Platform team | Website |
| **Appearance & Branding** | Layout, colours and fonts. | Pick a template and colour → Publish. | Admin | Website |
| **Website & Links** | Links between the app and the school website. | Copy deep links and the admission-form snippet into the school website. | Admin | Website |
| **Email & SMS Outbox** | Every email and SMS the app has sent (test inbox). | Open a message to read it. | Accountant, Admin | Website |
| **SMS Gateway** | Connect an SMS provider (MSG91, Amazon SNS, Gupshup, Twilio or your own API). | Choose provider → DLT template IDs → Dry run → Go live. | Admin | Website |

### 5.12 My Space

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **My Child** | Your child’s profile, attendance and results. | Pick the child if you have more than one. | Parent | Website; app for Parent |
| **Requests to School** | Send the school a request: leave, late arrival, pickup or drop in person, early leave, own transport, meet a teacher, certificate or query. | Pick the request card → fill the form → Send. Track status and gate codes below; cancel while open. | Parent | Website; app for Parent |
| **Fee Dues & Pay** | Fee dues and payment. | Pay online, or pay by bank transfer and enter the UTR. | Parent | Website; app for Parent |
| **My Payslips** <br>*Growth+* | Your payslips. | Open and print. | Teacher, Front Office, Principal, Accountant, Admin | Website; app for Accountant |
| **My Teaching Performance** <br>*Growth+* | Your own teaching results (only when shared). | Read-only. |  | Website |
| **My Account** | Your account: name, email or mobile, password, notifications, linked children; delete your account. | Change details (a code confirms new email or mobile). | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin | Website; app for Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin |
| **My Preferences** | Your display preferences. | Pick layout density and theme. | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin | Website |

### 5.13 View as Profile

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Parent** | Admin only: see the website and phone app exactly as a parent sees them. | Click it; a bar shows who you are viewing as. Switch Website / Phone app; Back to Admin returns. Preview only unless you tick “Act as this person”. | Admin | Website |
| **Teacher (class coordinator)** | Admin only: see the app as a teacher who is a class coordinator. | As above. | Admin | Website |
| **Teacher + Vice Principal** | Admin only: see the app as a teacher who is also Vice Principal (designation adds Users, Admissions and analytics). | As above. | Admin | Website |
| **Teacher + Head of Teaching Staff** | Admin only: see the app as a teacher who is Head of Teaching Staff. | As above. | Admin | Website |
| **Principal** | Admin only: see the app as the Principal. | As above. | Admin | Website |
| **Accountant** | Admin only: see the app as the Accountant. | As above. | Admin | Website |
| **Front Office** | Admin only: see the app as the Front Office. | As above. | Admin | Website |
| **Transport team** | Admin only: see the app as the Transport team. | As above. | Admin | Website |

### 5.14 Platform Console

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Schools & Plans** | Platform Console: schools, plans, modules, functions and the mobile app switch. | Pick a school → plan → switch modules / sub-menus / functions → Mobile app on or off. | Platform team | Website |

### 5.15 Help

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **User Guide & Demo** | This guide: guided demos, every menu explained, and what each role sees. | Start a guided demo — the bar at the bottom walks you through each step and signs you in as the right person. | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin, Platform team | Website |

## 6. Mobile app

- One app in Google Play and the App Store serves every school. On first open, enter the school code (from the school website or welcome email), then sign in with the same email or mobile and password as the website.
- The platform team switches the app on per school (Platform Console → Schools & Plans → Mobile app). New schools start with it off.
- Tabs follow section 3. More than five tabs: the extra ones are under **More**.
- Works offline with saved information; turn notifications on from Home.
- Parents delete their account in **Account → Delete my account**, or on the web at #/p/delete.

## 7. Common questions

- **A menu is missing.** Check the school's plan and switches (Platform Console), the role's permissions (Operations → Roles & Permissions), and whether the screen is set to *App only* for the role (Web & App Screens).
- **A link from the school website says "not available".** The person's role can't open that screen on the website; they are taken to their home screen.
- **A parent can't choose a pickup person.** New pickup people must be checked by the Front Office first (Gate Desk → Approve pickup people).
- **The coordinator doesn't see a request.** Meetings go to the teacher asked, certificates to the office; coordinators see leave, early leave and transport requests for their sections.
- **A change to app screens isn't showing.** It must be approved and published; people see it at their next sign-in or app refresh.
