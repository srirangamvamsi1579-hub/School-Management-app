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
| Sales team (our company) | sales@yourapp.example.com |

**Good to know**

- Emails and SMS are simulated: read them in Settings → Email & SMS Outbox, or the Test inbox on the sign-in page.
- Data stays in your browser; two tabs stay in step. Admins can reset it (Reset demo data button at the top).
- A school sees only the modules in its plan (Starter, Growth, Professional, Enterprise) or switched on for it. A person sees only the screens their role, designation or personal grants allow.

## 2. What each role sees

Website menus and phone tabs with the recommended layout. Schools change this in **Settings → Web & App Screens** (section 3).

| Role | Website (main menus and sub-menus) | Phone app tabs |
| --- | --- | --- |
| **Parent** | **Dashboard:** Dashboard<br>**Students:** Portfolios<br>**Academics:** Timetable<br>**Campus Services:** Events & Calendar, Homework, Online Classes<br>**My Space:** My Child, Requests to School, Fee Dues & Pay, My Account, My Preferences<br>**Help:** User Guide & Demo, FAQs | Home, Requests, Fees, My child, Homework, Events, Classes, Account |
| **Teacher** | **Dashboard:** Dashboard<br>**Students:** All Students, Student Profile, Attendance, Coordinator Desk, Parent Meetings, Report Cards, Portfolios<br>**Academics:** Boards, Syllabus & Textbooks, Timetable, Curriculum Planning<br>**Exams:** Question Papers, Approved Papers, Question Bank, Co-Scholastic Grades, Assessment Profiles<br>**Data Analytics:** Top & Bottom Performers<br>**Campus Services:** Events & Calendar, Homework, Online Classes, Library<br>**My Space:** My Payslips, My Leave, My Account, My Preferences<br>**Settings:** Templates<br>**Help:** User Guide & Demo, FAQs | Home, Timetable, Attendance, Approvals, Meetings, Homework, Account |
| **Front Office** | **Dashboard:** Dashboard<br>**Students:** All Students, Student Profile, Admissions & Enquiries, New Admission, Office Requests, Gate Desk, Documents & ID Cards<br>**Fees:** Collect Fee, Dues & Reminders, Receipts<br>**Transport:** Pickup & Drop Changes<br>**Data Analytics:** Admissions Funnel<br>**Campus Services:** Events & Calendar, Library, Inventory & Store, Hostel<br>**My Space:** My Payslips, My Leave, My Account, My Preferences<br>**Settings:** Templates<br>**Help:** User Guide & Demo, FAQs | Home, Gate, Office, Bus changes, Account |
| **Transport team** | **Transport:** Daily Bus Manifest, Driver Route Sheets, Pickup & Drop Changes, Routes, Stops & Timings<br>**Data Analytics:** Transport Reports<br>**Campus Services:** Events & Calendar<br>**My Space:** My Leave, My Account, My Preferences<br>**Help:** User Guide & Demo, FAQs | Home, Route sheet, Manifest, Bus changes, Account |
| **Principal** | **Dashboard:** Dashboard<br>**Students:** Insights, All Students, Student Profile, Admissions & Enquiries, Attendance, Coordinator Desk, Parent Meetings, Office Requests, Report Cards, Portfolios<br>**Staff:** Insights, All Staff, Staff Attendance, Leave Requests<br>**Academics:** Classes & Sections, Class Coordinators, Boards, Syllabus & Textbooks, Timetable, Curriculum Planning<br>**Exams:** Question Papers, Approved Papers, Question Bank, Blueprints, Co-Scholastic Grades, Assessment Profiles<br>**Fees:** Insights, Fee Request Emails, Payment Matching, Dues & Reminders, Fee Structure, Concessions<br>**Transport:** Daily Bus Manifest, Driver Route Sheets, Pickup & Drop Changes, Routes, Stops & Timings<br>**Data Analytics:** Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel<br>**Payroll:** Run Payroll, Payslips<br>**Accounts:** Account Statement, Income & Expenses<br>**Campus Services:** Events & Calendar, Homework, Online Classes, Library, Inventory & Store, Hostel<br>**My Space:** My Payslips, My Leave, My Account, My Preferences<br>**Settings:** Web & App Screens, Templates, Bank & Payment Details<br>**Help:** User Guide & Demo, FAQs | Home, Attendance, Approvals, Meetings, Office, Route sheet, Account |
| **Accountant** | **Dashboard:** Dashboard<br>**Students:** All Students<br>**Staff:** All Staff<br>**Fees:** Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions<br>**Data Analytics:** Report Catalogue, Transport Reports<br>**Payroll:** Run Payroll, Payslips<br>**Accounts:** Account Statement, Income & Expenses<br>**Campus Services:** Events & Calendar, Inventory & Store, Hostel<br>**My Space:** My Payslips, My Leave, My Account, My Preferences<br>**Settings:** Templates, Bank & Payment Details, Email & SMS Outbox<br>**Help:** User Guide & Demo, FAQs | Home, Payslips, Account |
| **Admin** | **Dashboard:** Dashboard<br>**Students:** Insights, All Students, Student Profile, Admissions & Enquiries, New Admission, Attendance, Coordinator Desk, Parent Meetings, Office Requests, Gate Desk, Report Cards, Documents & ID Cards, Portfolios<br>**Staff:** Insights, All Staff, Staff Attendance, Leave Requests<br>**Academics:** Classes & Sections, Class Coordinators, Boards, Syllabus & Textbooks, Timetable, Curriculum Planning<br>**Exams:** Question Papers, Approved Papers, Question Bank, Blueprints, Co-Scholastic Grades, Assessment Profiles<br>**Fees:** Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions<br>**Transport:** Daily Bus Manifest, Driver Route Sheets, Pickup & Drop Changes, Routes, Stops & Timings<br>**Data Analytics:** Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel<br>**Payroll:** Run Payroll, Payslips<br>**Accounts:** Account Statement, Income & Expenses<br>**Campus Services:** Events & Calendar, Homework, Online Classes, Library, Inventory & Store, Hostel<br>**Operations:** Users, Roles & Permissions, Data Import, Help Documents & FAQs<br>**My Space:** My Payslips, My Leave, My Account, My Preferences<br>**View as Profile:** Parent, Teacher (class coordinator), Teacher + Vice Principal, Teacher + Head of Teaching Staff, Principal, Accountant, Front Office, Transport team<br>**Service Provider:** Price List & Tiers, Proposal Builder, Demo Builder, Client Delivery, Competition Comparison, Market Review & Roadmap<br>**Settings:** Appearance & Branding, Website & Links, Web & App Screens, Templates, Bank & Payment Details, SMS Gateway, Email & SMS Outbox, Backups & Restore<br>**Help:** User Guide & Demo, FAQs | Home, Account |
| **Platform team** | **Platform Console:** Schools & Plans<br>**Service Provider:** Price List & Tiers, Proposal Builder, Demo Builder, Client Delivery, Competition Comparison, Market Review & Roadmap<br>**Settings:** Web & App Screens<br>**Help:** User Guide & Demo, FAQs | Website only |
| **Sales & marketing** | **Service Provider:** Price List & Tiers, Proposal Builder, Demo Builder, Client Delivery, Competition Comparison, Market Review & Roadmap<br>**Help:** User Guide & Demo, FAQs | Website only |

## 3. Web & App Screens (choosing what goes on the website and in the app)

**Settings → Web & App Screens.** For each role, each phone-ready screen is set to *Website + app*, *Website only* or *App only*. Screens not built for phones always stay on the website. Account is always on both, because the app stores require account deletion inside the app.

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
| Leave Requests | — | — | — | — | Website only | — | Website only |
| My Leave | — | Website only | Website only | Website only | Website only | Website only | Website only |
| My Payslips | — | Website only | Website only | — | Website only | Website + app | Website only |
| Homework | Website + app | Website + app | — | — | Website only | — | Website only |
| Events & Calendar | Website + app | Website only | Website only | Website only | Website only | Website only | Website only |
| Online Classes | Website + app | Website only | — | — | Website only | — | Website only |
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
3. **Sonia Mehta (Teacher, class coordinator 8-A) → Attendance:** Open the 8-A register for this month (or This week).  
   *You should see:* Aarav’s row shows L on the leave days.
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
3. **Sonia Mehta (Teacher, class coordinator 8-A) → Attendance:** Open the 8-A register; look at today’s column.  
   *You should see:* Aarav shows Lt (late — dropped by parent).

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

### 4.8 Question paper: topics → sets → approve → print

*Teacher, Principal · about 4 min*

1. **Sonia Mehta (Teacher, class coordinator 8-A) → Question Papers:** Exam Unit Test 2 → Class 6 Mathematics → Open. Show the topics of a chapter and untick one: the paper rebuilds from the remaining topics.  
   *You should see:* Every question is from a ticked topic; the table shows what the topics hold per section.
2. **Sonia Mehta (Teacher, class coordinator 8-A) → Question Papers:** Add a set → Send set 1 for approval.  
   *You should see:* Overlap between sets shown; set 1 locked while it waits.
3. **Dr. Kavita Menon (Principal) → Question Papers:** Open Class 6 Mathematics → Set 1 → Approve → choose Set 1 for the exam.  
   *You should see:* Set 1 is the set for the exam; the others are sealed.
4. **Sonia Mehta (Teacher, class coordinator 8-A) → Approved Papers:** Unit Test 2 → Print, Answer key or Teacher’s copy.  
   *You should see:* Print views of the chosen set.

### 4.9 Monthly payroll

*Accountant, Teacher · about 2 min*

1. **Sana Khan (Accountant) → Run Payroll:** Pick the month → check figures → Approve → Post.  
   *You should see:* Voucher posted to accounts.
2. **Sonia Mehta (Teacher, class coordinator 8-A) → My Payslips:** Open the payslip.  
   *You should see:* Shows basic, allowances, PF, TDS and net.

### 4.10 New accounts from the app: checked against the school records, no approval

*Parent or staff (new), Admin · about 4 min*

1. **Without signing in → #/p/mobile:** Phone app → school code GVS → Create an account as a Parent. Give the student’s admission number ADM-2025-0231, name Aarav Sharma and grade Grade VIII. Verify the code (shown on screen), set a password.  
   *You should see:* The details match the student record, so the account is ready at once. A wrong grade or name is refused (5 tries).
2. **Without signing in → #/p/mobile:** Create another account as School staff: name Kavya Iyer, sign-in ID kavya.iyer@example.com, employee code EMP-0131.  
   *You should see:* The details match the staff record, so the account opens at once as Teacher · PRT.
3. **Admin user (Admin) → Users:** Both new accounts are Active: the parent with Aarav Sharma · Grade VIII, Kavya as Teacher · PRT. Edit shows how each was created.  
   *You should see:* Nobody waited for approval.

### 4.11 Add a user: designations follow the role

*Admin · about 2 min*

1. **Admin user (Admin) → Users:** Add user → Role Transport team: the designations are Transport In-charge, Transport Supervisor, Driver, Cleaner, Bus Helper / Attendant. Change the role to Parent: the designation is simply Parent.  
   *You should see:* Each role offers only its own designations.
2. **Admin user (Admin) → Roles & Permissions:** User management → Transport team (department Transport) → add the designation “Route Marshal”.  
   *You should see:* It is offered next time a Transport user is added.

### 4.12 See the app as each profile (Admin)

*Admin · about 2 min*

1. **Admin user (Admin) → Main menu:** Main menu → View as Profile → Parent (the same items are in the side menu).  
   *You should see:* The menus change to the parent’s; a bar says who you are viewing as.
2. **Admin user (Admin) → Main menu:** In the bar, switch to Phone app, then Back to Admin.  
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

1. **Manjunath Gowda (Transport In-charge) → Routes, Stops & Timings:** Pick R4 → Plan the route → Shortest drive → Use this route.  
   *You should see:* R4 is shorter; the new stop times show in Stops & timings.
2. **Manjunath Gowda (Transport In-charge) → Driver Route Sheets:** Pick the day → What the driver sees → Send to all drivers.  
   *You should see:* Each driver gets only their route.
3. **Manjunath Gowda (Transport In-charge) → Daily Bus Manifest:** Morning trip; mark Boarded / No-show.  
   *You should see:* Not-boarding children show the reason.

### 4.16 Staff leave: apply → approver notified → approve

*Teacher, Vice Principal / Principal · about 2 min*

1. **Sonia Mehta (Teacher, class coordinator 8-A) → My Leave:** Sonia: pick Casual leave, a date next week, reason "Family function" → Send for approval.  
   *You should see:* It shows Waiting for approval; casual leave left goes down by the days asked.
2. **Dr. Kavita Menon (Principal) → Leave Requests:** The Principal: the 🔔 bell shows a new notification. Open Waiting for approval → Approve Sonia’s leave.  
   *You should see:* Approved; Sonia is notified.
3. **Dr. Kavita Menon (Principal) → Staff Attendance:** Open the staff register for next week.  
   *You should see:* Sonia’s row shows L on those days.
4. **Sonia Mehta (Teacher, class coordinator 8-A) → My Leave:** Back as Sonia.  
   *You should see:* The request shows Approved by Dr. Kavita Menon; the bell has the decision.

### 4.17 Report cards: generate → publish → parent opens

*Principal, Parent · about 2 min*

1. **Dr. Kavita Menon (Principal) → Report Cards:** Grade VIII, section A, all students, Term 1 → Generate.  
   *You should see:* One card per student with marks, grades, rank and attendance.
2. **Dr. Kavita Menon (Principal) → Report Cards:** Publish to parents.  
   *You should see:* Parents are notified.
3. **Rohit Sharma (Parent of Aarav, 8-A) → My Child:** The parent: Report cards → Open → Print / save as PDF.  
   *You should see:* Aarav’s Term 1 report card.

### 4.18 Plan a bus route and add a stop

*Transport · about 3 min*

1. **Manjunath Gowda (Transport In-charge) → Routes, Stops & Timings:** R4 → Plan the route. Compare the options; pick Shortest drive → Use this route.  
   *You should see:* About 13 minutes shorter; stop times worked out again.
2. **Manjunath Gowda (Transport In-charge) → Routes, Stops & Timings:** R2 → Pickup suggestions → Add this stop (name it) for the three riders who live far from a stop.  
   *You should see:* The stop is added where it adds the least driving; the riders board there.
3. **Manjunath Gowda (Transport In-charge) → Driver Route Sheets:** Open R2’s route sheet.  
   *You should see:* The new stop and times are on the driver’s sheet.

### 4.19 Results and teacher performance

*Principal, Head of Teaching Staff, Teacher · about 2 min*

1. **Dr. Kavita Menon (Principal) → Top & Bottom Performers:** Grade IX, all sections; then pick two sections.  
   *You should see:* Top 6 and bottom 6 change.
2. **Murali Krishnan (Teacher + Head of Teaching Staff) → Teacher Performance:** Switch "Share with teachers" on.  
   *You should see:* Teachers get My Teaching Performance (view only).
3. **Sonia Mehta (Teacher, class coordinator 8-A) → My Teaching Performance:** As a teacher.  
   *You should see:* Only her own subjects and sections.

### 4.20 Proposal → demo school → client visit (our sales team)

*Sales & marketing · about 4 min*

1. **Sales team (our company) → Proposal Builder:** New proposal: “Hillview School”, 650 students, contact name, email and phone. Choose Pro. Add Transport routes and route map (8 buses), Timings, SMS and Data analytics.  
   *You should see:* A year: ₹3,30,000 (Pro ₹2,59,000 by band + storage ₹7,800 + transport ₹24,000 + timings ₹8,000 + SMS ₹11,700 + analytics ₹19,500); maximum discount 13.5%.
2. **Sales team (our company) → Proposal Builder:** Discount 10% → Download PDF → Email proposal → Send email.  
   *You should see:* Discount ₹31,050; profit falls from 25.9% to 18.2%. The PDF has the plan cards with Pro selected; the email is in the Outbox and the proposal says Sent.
3. **Sales team (our company) → Demo Builder:** Pick Hillview School → step 4: add Portfolios → Create demo school.  
   *You should see:* The proposal now lists Portfolios too; the demo script includes Portfolios and the route map.
4. **Sales team (our company) → Demo Builder:** Open as Principal, show two screens from the script, then End demo at the top.  
   *You should see:* The demo school name shows at the top left; End demo brings you back to the Demo builder.
5. **Sales team (our company) → Competition Comparison:** Enter 650 students and look at the price row and Our edge.  
   *You should see:* Our price sits among the Indian providers; route planning and the free app show as our edge.

### 4.21 Homework and the school calendar reach parents

*Teacher, Front Office, Parent · about 3 min*

1. **Sonia Mehta (Teacher, class coordinator 8-A) → Homework:** Set homework for 8-A, Mathematics, due tomorrow.  
   *You should see:* It appears in the list with 0 of the class done.
2. **Anita Rao (Front Office) → Events & Calendar:** Add event “Annual Day rehearsal”, for parents, next Friday → Save → Send to parents.  
   *You should see:* It says Sent; parents get it in the app bell.
3. **Anita Rao (Front Office) → Library:** Issue & return → find Aarav → pick a book → Issue.  
   *You should see:* Due back in 14 days; the book shows one fewer on the shelf.
4. **Rohit Sharma (Parent of Aarav, 8-A) → Homework:** As the parent, open Homework.  
   *You should see:* Aarav’s 8-A homework shows with its due date.

## 5. Every menu explained

### 5.1 Dashboard

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Dashboard** | The school at a glance, in sections: Students, Staff, Transport, Fees, Enrolment and Needs attention. Each compares this year with last year (▲ up, ▼ down) and starts with “What this tells you” — the figures explained in plain words. | Students: totals, boys and girls, grade limits, attendance. Staff: full-time and part-time counts, salary paid this year by employee type and staff group, students per teacher, leave waiting. Transport: riders per route against last year, the bus fleet (in service, spare, under repair) and every breakdown. Fees: collected against what is due and the target. Enrolment: where accounts came from. | Parent, Teacher, Front Office, Principal, Accountant, Admin | Website |

### 5.2 Students

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Insights** <br>*Pro+* | Student numbers, attendance and fee trends (Power BI). | Use the grade and month filters; export from the report menu. | Principal, Admin | Website |
| **All Students** | Every student with class, guardian and transport. | Search by name or admission number; click a student to open the profile. | Teacher, Front Office, Principal, Accountant, Admin | Website |
| **Student Profile** | A student’s full profile: personal, academic, performance and attendance. | Find the student by grade, section or name; switch between the four tabs. Performance shows % per test and rank in the section and grade. | Teacher, Front Office, Principal, Admin | Website |
| **Admissions & Enquiries** | Enquiries and applications for next year, from first call to enrolment, with a summary by grade. | Add an enquiry or application form; move it Submitted → In review → Offered → Enrolled, or Opted out with a reason. Website enquiries arrive here automatically. | Front Office, Principal, Admin | Website |
| **New Admission** | Admit a student directly (without the enquiry pipeline). | Fill child, class-section, guardian and transport; the admission number is generated. | Front Office, Admin | Website |
| **Attendance** | The attendance register: one row per student, one column per day. | Pick the section and a date range (today, week, month or your own). Tap a cell: Present → Absent → Late. Leave (L) comes from approved requests; Sundays and holidays are greyed. Submit today’s attendance to text absent students’ guardians. | Teacher, Principal, Admin | Website; app for Teacher, Principal |
| **Coordinator Desk** | Coordinator Desk: leave, early-leave, pickup, drop and transport requests for the sections you coordinate. | Approve or decline (a reason is needed); approving an early leave sends the parent a gate code. | Teacher, Principal, Admin | Website; app for Teacher, Principal |
| **Parent Meetings** | Parents asking to meet or call you. | Click Reply, pick a date and time (or decline with a note); the parent is told by email and in the app. | Teacher, Principal, Admin | Website; app for Teacher, Principal |
| **Office Requests** | Certificates, documents and queries sent by parents. | Open item → Update → Mark done with a message (e.g. "Ready at the office"), or decline. | Front Office, Principal, Admin | Website; app for Front Office, Principal |
| **Gate Desk** | Gate Desk: today’s collections and expected late arrivals; checking new pickup people. | Check photo ID, enter the 4-digit gate code, Hand over. For late arrivals press Arrived. "Approve pickup people" checks new collectors. | Front Office, Admin | Website; app for Front Office |
| **Report Cards** | Report cards (academic profile) for printing, saving as PDF and publishing to parents. | Pick grade, section, student (or all) and a term, the whole year or one exam → Generate → Print / save as PDF → Publish to parents. | Teacher, Principal, Admin | Website |
| **Documents & ID Cards** | Documents and ID cards. | Upload or print certificates and ID cards from the school’s templates. | Front Office, Admin | Website |
| **Portfolios** <br>*Pro++* | Student portfolios (add-on): best work, projects, reflections and certificates with a teacher’s comment. Shared items show to parents. | Find the student → Add to portfolio → title, kind, subject, date, comment → Share with parents → Save. | Parent, Teacher, Principal, Admin | Website |

### 5.3 Staff

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Insights** <br>*Pro+* | Staff numbers, attendance and leave trends. | Filter by department. | Principal, Admin | Website |
| **All Staff** | Every staff member, with Add staff and Edit on the same screen. | Search or filter by department and full / part time. Add staff (top right) creates the staff record and employee code; staff then register themselves with it. | Principal, Accountant, Admin | Website |
| **Staff Attendance** | The staff attendance register. | Filter by department and pick a range. Tap a cell: Present → Absent → Half day. Approved leave shows as L. | Principal, Admin | Website |
| **Leave Requests** | Approve staff leave; see all requests, leave taken by each person and the leave types. | Approvers are notified (🔔 and email). Approve, or Decline with a reason; the staff member is told. Admin and Principal change the yearly allowances. | Principal, Admin | Website (can be added to the app) |

### 5.4 Academics

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Classes & Sections** | Classes and sections with capacity. | Add sections; set capacity (used for admissions seats). | Principal, Admin | Website |
| **Class Coordinators** | Primary and secondary class coordinator for each section. | Pick two different teachers per section; they receive that section’s parent requests. | Principal, Admin | Website |
| **Boards, Syllabus & Textbooks** | Boards, textbooks, chapters and topics. | Pick the board and class; chapters feed question papers. | Teacher, Principal, Admin | Website |
| **Timetable** | Class and teacher timetables. | Click a cell to set subject and teacher; clashes are flagged. Parents see their child’s. | Parent, Teacher, Principal, Admin | Website; app for Teacher |
| **Curriculum Planning** <br>*Pro++* | Curriculum planning (LMS add-on): units for each class and subject by month, and how many periods are taught. | Pick the class and subject → Add a unit (month, periods, outcomes) → type the periods taught as you go; coverage updates. | Teacher, Principal, Admin | Website |

### 5.5 Exams

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Question Papers** | Build each exam paper from the topics you choose: sets, versions, approval and printing. | Pick the exam → Start a class and subject → tick chapters and topics (the paper rebuilds itself) → adjust questions → Add sets → Send each set for approval → choose the set for the exam. | Teacher, Principal, Admin | Website |
| **Approved Papers** | Approved sets ready for the exam. | Pick the exam → Print the chosen set, its answer key or the teacher’s copy. | Teacher, Principal, Admin | Website |
| **Question Bank** | Chapters, topics and questions per class and subject (Easy / Medium / Hard). | Pick the class and subject → add chapters and topics → add, edit, duplicate or archive questions; teachers’ new questions go to review. | Teacher, Principal, Admin | Website |
| **Blueprints** | Blueprints: the pattern of each kind of paper (sections, types, marks, OR choices, chapters). | Edit or copy a blueprint; papers pick the one that fits their exam and class. | Principal, Admin | Website |
| **Co-Scholastic Grades** | Co-scholastic grades (A/B/C). | Pick class and area; set grades. | Teacher, Principal, Admin | Website |
| **Assessment Profiles** | Assessment profiles and appreciation cards. | Write subject comments; print the profile. | Teacher, Principal, Admin | Website |

### 5.6 Fees

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Insights** <br>*Pro+* | Fee collection, dues and trends (Power BI). | Filter by grade and month. | Principal, Accountant, Admin | Website |
| **Collect Fee** | Take a fee payment at the counter. | Find the student, pick invoices, mode (cash / card / UPI), save; the receipt prints in the school’s format. | Front Office, Accountant, Admin | Website |
| **Fee Request Emails** | Send fee request emails by grade with a personal pay link. | Pick grades and instalment → Preview → Send. Parents without email get an SMS. | Principal, Accountant, Admin | Website |
| **Payment Matching** <br>*Pro+* | Match incoming bank / UPI / gateway payments to fee requests. | Most match automatically; for the rest pick the request and Match. Duplicates are flagged. | Principal, Accountant, Admin | Website |
| **Dues & Reminders** | Who owes what, with reminders. | Filter overdue; send reminders; open an invoice. | Front Office, Principal, Accountant, Admin | Website |
| **Receipts** | All receipts. | Search, reprint or email a receipt. | Front Office, Accountant, Admin | Website |
| **Fee Structure** | Fee heads and amounts per grade and instalment. | Edit heads and amounts for the year. | Principal, Accountant, Admin | Website |
| **Concessions** <br>*Pro+* | Concessions and scholarships. | Add a concession for a student; it applies to new invoices. | Principal, Accountant, Admin | Website |

### 5.7 Transport

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Daily Bus Manifest** | Daily bus manifest: who boards, who doesn’t and why, for morning and afternoon. | Pick date, trip and route. With attendant tracking on, mark Boarded / No-show. Send to transport team. | Transport team, Principal, Admin | Website; app for Transport team |
| **Driver Route Sheets** | One route sheet per driver with stop timings and who to wait for. | Pick the day → Send to all drivers (each gets only their route by SMS link) or Download all (Excel). | Transport team, Principal, Admin | Website; app for Transport team, Principal |
| **Pickup & Drop Changes** | Every request that changes the bus, today and coming days. | Read-only list for transport and front office. | Front Office, Transport team, Principal, Admin | Website; app for Front Office, Transport team |
| **Routes, Stops & Timings** | Routes, stops, timings, the route map and route planning. | Pick a route. Plan the route compares orders of stops (shortest drive, farthest first, fewer stops). Pickup suggestions move riders to a nearer stop or add a new stop. Add or move stops on the map; times are worked out again. | Transport team, Principal, Admin | Website |

### 5.8 Data Analytics (from the Pro plan)

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Report Catalogue** <br>*Pro+* | Catalogue of Power BI reports. | Open a report. | Principal, Accountant, Admin | Website |
| **Top & Bottom Performers** <br>*Pro+* | Top 6 and bottom 6 per grade. | Pick grade (and sections, term, subject). | Teacher, Principal, Admin | Website |
| **Transport Reports** <br>*Pro+* | Route use, cost per km, on-time and fee revenue. | Filter by grade. | Transport team, Principal, Accountant, Admin | Website |
| **Teacher Performance** <br>*Pro+* | How each teacher’s students are doing. | Filter by grade and subject. The Principal or Head of Teaching Staff can share it with teachers (view only). | Principal, Admin | Website |
| **Admissions Funnel** <br>*Pro+* | Admissions funnel and conversion. | Filter by grade and source. | Front Office, Principal, Admin | Website |

### 5.9 Payroll (from the Pro plan)

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Run Payroll** <br>*Pro+* | Monthly payroll. | Pick the month → check → Approve → Post to accounts; payslips are released. | Principal, Accountant, Admin | Website |
| **Payslips** <br>*Pro+* | All payslips. | Search and print. | Principal, Accountant, Admin | Website |

### 5.10 Accounts

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Account Statement** <br>*Pro++* | Account statement with running balance. | Pick account and dates. | Principal, Accountant, Admin | Website |
| **Income & Expenses** <br>*Pro++* | Income and expenses. | Add expenses; see the summary. | Principal, Accountant, Admin | Website |

### 5.11 Campus Services

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Events & Calendar** | The school calendar: events, exams, parent meetings, circulars and holidays. | Add event → title, type, dates, who it is for → Save. Then “Send to …” puts it in the app for parents and/or staff. Tick Show past for earlier events. | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin | Website; app for Parent |
| **Homework** | Homework for each class, and who has done it. Parents see their child’s homework and status. | Set homework → class, subject, what to do, due date → Save. Open Mark to tick Done, Late or Missing for each student. | Parent, Teacher, Principal, Admin | Website; app for Parent, Teacher |
| **Online Classes** <br>*Pro+* | Live online classes with a Google Meet, Zoom or Teams link, and who attended. | Schedule a class → class, subject, date, time, minutes, meeting link. Students and parents join from Coming up. After the class, Held → Attendance. | Parent, Teacher, Principal, Admin | Website; app for Parent |
| **Library** <br>*Pro+* | Library catalogue, issue and return, overdue books and fines. | Issue & return → find the student, pick a book → Issue. Return shows any fine. Catalogue → Add book. Overdue → Remind parent. | Teacher, Front Office, Principal, Admin | Website |
| **Inventory & Store** <br>*Pro++* | Uniforms, books and stationery: stock, sales to students, re-ordering. | Receive stock when a delivery arrives; Sell to a student → find the student, item, quantity → Save shows the amount to collect. Items at or below the re-order level are flagged. | Front Office, Principal, Accountant, Admin | Website |
| **Hostel** <br>*Pro+ Enterprise+* | Hostel blocks, rooms and beds, residents and monthly hostel fees. | Give a bed → find the student → pick a room with a free bed in the right block → mess yes or no → Save. Vacate frees the bed. | Front Office, Principal, Accountant, Admin | Website |

### 5.12 Operations

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Users** | Accounts: filter by role, department and status, 25 to a page; see each parent’s student (admission no., name, grade), the created date and last sign-in; approve staff sign-ups, add users, change roles, designation and status; delete (the account moves to Archived). | Add user or Review a staff sign-up → pick the role (the designation list then shows only that role’s designations; parents show N/A) → Active. Parents never wait for approval: they are checked against the student record when they register. To delete, Edit → Status Deleted → pick a reason → confirm. ↻ Refresh brings in changes made in Roles & Permissions. Reset password shows only for the Admin, or people the Admin gives that permission in Edit. Archived is view only, with its own filters. Accounts are created when parents and staff register on the website or in the app; only the Admin can Add user, as an exception with a reason. Someone coming back: Add user → search the archive → Copy details (anything that no longer fits is pointed out). Edit shows how each account was created. | Admin | Website |
| **Roles & Permissions** | User management: profiles, departments and designations; add from the standard list for Indian schools or delete profiles. Permissions by department: No access, Read only or Full access for each main menu and sub-menu. Access summary: each person, their profile, department, designation and what they can open. | Permissions by department → pick a department → set a main menu (all its sub-menus) or expand it and set single sub-menus. Read only opens the screen but blocks saving. Access summary → filter by department or profile → Show access. | Admin | Website |
| **Data Import** | Load existing data with the conversion templates, or any Excel, CSV or photo. | Templates: download one per menu (01_Class_Section_Data.xlsx …). Fill and upload named NN_Name_Data_SCHOOL_YYYYMMDD.xlsx; the template is recognised and every row checked. Students and staff go through column mapping and can be rolled back. | Admin | Website |
| **Help Documents & FAQs** | The school’s own help documents and FAQs. | Add a document (link or file) or a question, and choose which roles see it. They appear in Help → FAQs. | Admin | Website |

### 5.13 My Space

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **My Child** | Your child’s profile, attendance and results. | Pick the child if you have more than one. | Parent | Website; app for Parent |
| **Requests to School** | Send the school a request: leave, late arrival, pickup or drop in person, early leave, own transport, meet a teacher, certificate or query. | Pick the request card → fill the form → Send. Track status and gate codes below; cancel while open. | Parent | Website; app for Parent |
| **Fee Dues & Pay** | Fee dues and payment. | Pay online, or pay by bank transfer and enter the UTR. | Parent | Website; app for Parent |
| **My Payslips** <br>*Pro+* | Your payslips. | Open and print. | Teacher, Front Office, Principal, Accountant, Admin | Website; app for Accountant |
| **My Leave** | Your leave: what is left of each type, apply, and your requests. | Pick the leave type and dates (or a half day), give a reason and send. The approvers are notified; you are told when they decide. | Teacher, Front Office, Transport team, Principal, Accountant, Admin | Website (can be added to the app) |
| **My Teaching Performance** <br>*Pro+* | Your own teaching results (only when shared). | Read-only. |  | Website |
| **My Account** | Your account: name, email or mobile, password, notifications, linked children; delete your account. | Change details (a code confirms new email or mobile). | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin | Website; app for Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin |
| **My Preferences** | Your display preferences. | Pick layout density and theme. | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin | Website |

### 5.14 View as Profile

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

### 5.15 Platform Console

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Schools & Plans** | Platform Console: schools, plans, modules, functions and the mobile app switch. | Pick a school → plan → switch modules / sub-menus / functions → Mobile app on or off. | Platform team | Website |

### 5.16 Service Provider

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Price List & Tiers** | Pricing: the Starter, Pro and Pro+ plans with price per student a year in bands, what a year costs by school size, a plan comparison, every add-on with its price, and the cost, margin and discount rules. | Pick a plan (Start with Starter, Choose Pro, Choose Pro+) to start a proposal with it. Platform team or Admin: Edit prices → change → Save prices, or Back to Pricing to leave without saving. | Admin, Platform team, Sales & marketing | Website |
| **Proposal Builder** | Priced proposals: client and point of contact, plan, add-ons, hosting and discount, with price, operating cost, gross margin, profit and the maximum discount worked out as you go. | New proposal (or a plan’s Choose button) → fill in the school and contact → pick the plan and add-ons → discount → Preview PDF or Download PDF → Email proposal. Choices save as you go. | Admin, Platform team, Sales & marketing | Website |
| **Demo Builder** | Sets up a working demo school for a client visit in four steps, linked to a proposal: what you change here changes the proposal and the demo school. | Pick the client or New client → 1 check the service provider (pre-filled) → 2 school and point of contact → 3 plan → 4 add-ons and discount → Create demo school → Open as Principal, Teacher or Parent. End demo at the top brings you back. | Admin, Platform team, Sales & marketing | Website |
| **Client Delivery** | Client delivery: a won proposal becomes a client project — the school set up as sold, eight documents (scope, website, app build, hosting and AWS, data migration, testing, go-live, links register), a starter website page, and every link with its environment, version and date. | Convert to client (or set a proposal to Won) → Links: fill in each placeholder as hosting, AWS and store builds become ready → Documents: Preview or Download PDF → Website: Download HTML → Share with customer (email with links and PDFs). If the proposal changes, Regenerate makes the next version. | Admin, Platform team, Sales & marketing | Website |
| **Competition Comparison** | Our features and price against Indian and global school software, with our edge and our gaps. | Enter the school’s student count to see each provider’s estimated yearly price at the top; filter Indian, global or all, and by feature group. Sources are listed at the bottom. | Admin, Platform team, Sales & marketing | Website |
| **Market Review & Roadmap** | Indian and global market review (with each provider’s country) and the future enhancements we plan. | Read the Indian and Global tabs; Future enhancements lists each idea with where it comes from — set its priority and status as plans change. | Admin, Platform team, Sales & marketing | Website |

### 5.17 Settings

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **Appearance & Branding** | Layout, colours and fonts. | Pick a template and colour → Publish. | Admin | Website |
| **Website & Links** | Links between the app and the school website. | Copy deep links and the admission-form snippet into the school website. | Admin | Website |
| **Web & App Screens** | Which screens each role sees on the website, in the mobile app, or both. | Pick a role → choose Website + app / Website only / App only → Send for approval → the Principal approves → published. | Principal, Admin, Platform team | Website |
| **Templates** | Invoices, receipts, emails, payslips and letters in the school’s own format. | Use standard, Copy & edit, or Upload; set the default. | Teacher, Front Office, Principal, Accountant, Admin | Website |
| **Bank & Payment Details** | The school’s bank and UPI details shown on invoices. | Edit; a second person (Principal) approves before it is used. | Principal, Accountant, Admin | Website |
| **SMS Gateway** | Connect an SMS provider (MSG91, Amazon SNS, Gupshup, Twilio or your own API). | Choose provider → DLT template IDs → Dry run → Go live. | Admin | Website |
| **Email & SMS Outbox** | Every email and SMS the app has sent (test inbox). | Open a message to read it. | Accountant, Admin | Website |
| **Backups & Restore** <br>*Pro+* | Backups & restore (add-on): nightly automatic backups kept 30 days, a backup on demand, and restore from a backup file. | Back up now downloads the backup file. To restore: Choose backup file → check what it contains → Restore. Only the Admin can restore. | Admin | Website |

### 5.18 Help

| Sub-menu | What it is for | How to use it | Who can open it | Where |
| --- | --- | --- | --- | --- |
| **User Guide & Demo** | This guide: guided demos, the screen-by-screen flow, every menu explained, and what each role sees — filtered to what your school has and you can open. | Start a guided demo, or open Screen by screen for the steps on each screen. | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin, Platform team, Sales & marketing | Website |
| **FAQs** | Frequently asked questions for your role, and the school’s documents. | Search or pick a topic and open a question. | Parent, Teacher, Front Office, Transport team, Principal, Accountant, Admin, Platform team, Sales & marketing | Website |

## 6. Screen by screen

How to use each screen, in the order you click through it. In the app (Help → User Guide & Demo → Screen by screen) this list follows the school's plan, the functions switched on and the person's access; here every screen is listed.

### 6.1 Dashboard

**Dashboard** — The school at a glance, in sections: Students, Staff, Transport, Fees, Enrolment and Needs attention. Each compares this year with last year (▲ up, ▼ down) and starts with “What this tells you” — the figures explained in plain words.

1. Open Dashboard
2. Pick a section tab: Students, Staff, Transport, Fees, Enrolment, Needs attention
3. Read “What this tells you” first
4. Hover or tab onto a bar for exact numbers
5. Show as table for the numbers behind a chart

- *▲ / ▼ compare with last year (2025-26).*
- *Staff shows full-time and part-time counts and salary paid by type; Transport shows riders per route against last year, the bus fleet and every breakdown.*
- *Admin and Principal can change grade limits from the Students tab.*

### 6.2 Students

**Insights** — Student numbers, attendance and fee trends (Power BI).

1. Open Insights
2. Choose grade and month
3. Use the report menu to export

- *Growth plan and above; a Power BI report filtered to your school.*

**All Students** — Every student with class, guardian and transport.

1. Search by name, admission no. or guardian
2. Filter by grade
3. Click a student
4. Read the profile in the pop-up

- *Teachers see guardian mobiles masked to the last 4 digits.*

**Student Profile** — A student’s full profile: personal, academic, performance and attendance.

1. Pick grade and section
2. Search or click a student
3. Personal profile: details, family, transport, fees
4. Academic profile: class, teachers, coordinators, co-scholastic grades, comments
5. Performance: % per test, rank in section and grade, comparison with classmates
6. Attendance report: month by month

- *On the comparison strip each dot is a classmate; the large dot is this student.*
- *Parents see the same profile for their own child in My Child.*

**Admissions & Enquiries** — Enquiries and applications for next year, from first call to enrolment, with a summary by grade.

1. Add an enquiry (or it arrives from the website form)
2. Open it → fill the application → Submitted
3. In review → interaction date
4. Offered (needs birth certificate and photo)
5. Enrolled — the student is created
6. Or Opted out with a reason

- *The summary by grade shows seats still free.*

**New Admission** — Admit a student directly (without the enquiry pipeline).

1. Fill the student details
2. Fill the guardian details
3. Choose transport zone
4. Save admission — the admission number is generated

- *Use Admissions & Enquiries for next year’s intake; this screen is for a direct admission.*

**Attendance** — The attendance register: one row per student, one column per day.

1. Pick class and section
2. Pick the range: Today, This week, This month, Last month or your own dates
3. Each row is a student, each column a day
4. Tap a cell: Present → Absent → Late
5. Submit today’s attendance — absent students’ guardians get an SMS

- *L (leave) comes from approved parent requests and can’t be changed here.*
- *Sundays and school holidays are greyed out.*
- *Totals at the end of each row: days present, absent and %.*

**Coordinator Desk** — Coordinator Desk: leave, early-leave, pickup, drop and transport requests for the sections you coordinate.

1. Open Coordinator Desk
2. See requests for your sections
3. Approve, or Decline with a reason
4. Approved early leave creates a gate code for the parent

- *Either coordinator of a section can decide.*

**Parent Meetings** — Parents asking to meet or call you.

1. See meeting requests to you
2. Reply with a date and time, or decline with a note
3. The parent is emailed

- *No personal phone numbers are shared.*

**Office Requests** — Certificates, documents and queries sent by parents.

1. See certificate, TC and other requests
2. Prepare the document
3. Mark done with a message, or decline

**Gate Desk** — Gate Desk: today’s collections and expected late arrivals; checking new pickup people.

1. See today’s collections in time order
2. Check the collector’s photo and ID
3. Enter the 4-digit gate code
4. Hand over — the time is recorded

- *A wrong code means do not release.*
- *Approve pickup people from the button at the top.*

**Report Cards** — Report cards (academic profile) for printing, saving as PDF and publishing to parents.

1. Pick grade, section and (optionally) one student
2. Pick the report: Term 1, Term 2, Whole year, or one exam
3. Generate
4. Check the cards on screen
5. Print / save as PDF
6. Publish to parents — they are told and can open it in My Child

- *Grades use the CBSE 8-point scale (A1 … E).*
- *Publishing again replaces the earlier copy for the same report.*
- *This menu replaces Promote / Transfer.*

**Documents & ID Cards** — Documents and ID cards.

1. Pick class and section
2. Print ID cards

**Portfolios** — Student portfolios (add-on): best work, projects, reflections and certificates with a teacher’s comment. Shared items show to parents.

1. Find the student
2. Add to portfolio
3. Share with parents

- *Portfolios add-on (in Pro+). Parents see shared items.*

### 6.3 Staff

**Insights** — Staff numbers, attendance and leave trends.

1. Open Insights
2. Filter by department

**All Staff** — Every staff member, with Add staff and Edit on the same screen.

1. Search or filter by department and full / part time
2. Add staff (top right) → fill details → Save — the employee code is generated
3. Edit a row to change details, employment type or pay

- *Staff register for an account with their employee code, name and the mobile or email on this record — no approval needed.*
- *Add Staff is now inside All Staff.*

**Staff Attendance** — The staff attendance register.

1. Filter by department
2. Pick the range
3. Each row is a staff member, each column a day
4. Tap a cell: Present → Absent → Half day

- *Approved leave shows as L and is locked.*
- *Only the Admin and the Principal change it.*

**Leave Requests** — Approve staff leave; see all requests, leave taken by each person and the leave types.

1. A notification (🔔 and email) says leave is waiting
2. Waiting for approval → Approve, or Decline with a reason
3. All requests → filter by status, type or person
4. Leave taken by staff → taken / allowed per type
5. Leave types → Change allowances (Admin, Principal)

- *Teaching staff: the Principal or the Vice Principal approves. Others: the Principal or the Admin. The Principal’s own leave goes to the Admin.*
- *Nobody approves their own leave.*

### 6.4 Academics

**Classes & Sections** — Classes and sections with capacity.

1. See each class, board, sections, class teacher and student count

**Class Coordinators** — Primary and secondary class coordinator for each section.

1. Pick a section
2. Set the primary and secondary coordinator (different people)
3. Save

- *Coordinators get parent requests for the section.*

**Boards, Syllabus & Textbooks** — Boards, textbooks, chapters and topics.

1. Pick the board
2. See chapters and topics
3. Question counts per chapter

**Timetable** — Class and teacher timetables.

1. Pick the section (or teacher)
2. Click a cell to set subject and teacher
3. Clashes are refused

- *Grade-wide blocks cover every section.*

**Curriculum Planning** — Curriculum planning (LMS add-on): units for each class and subject by month, and how many periods are taught.

1. Pick class and subject
2. Add a unit: month, periods, outcomes
3. Type periods taught
4. Watch coverage

- *LMS add-on (in Pro+).*

### 6.5 Exams

**Question Papers** — Build each exam paper from the topics you choose: sets, versions, approval and printing.

1. Pick the exam
2. Start (or Open) a class and subject
3. Tick the topics for this paper
4. Check “What the chosen topics hold”
5. Add sets, edit questions
6. Send for approval

- *With automatic update on, changing topics rebuilds draft sets.*

**Approved Papers** — Approved sets ready for the exam.

1. Pick the exam
2. Print the chosen set, answer key or teacher’s copy

**Question Bank** — Chapters, topics and questions per class and subject (Easy / Medium / Hard).

1. Pick class and subject
2. Filter by chapter, type, difficulty
3. Add, edit, approve or archive questions

- *Only approved questions go into papers.*

**Blueprints** — Blueprints: the pattern of each kind of paper (sections, types, marks, OR choices, chapters).

1. Open a blueprint
2. Set marks, time, chapter rule and sections
3. Save

**Co-Scholastic Grades** — Co-scholastic grades (A/B/C).

1. Pick the section
2. Choose A / B / C for each area

- *Shown on report cards.*

**Assessment Profiles** — Assessment profiles and appreciation cards.

1. Pick a student
2. Write subject comments
3. Save

- *Shown in the Academic profile and on report cards.*

### 6.6 Fees

**Insights** — Fee collection, dues and trends (Power BI).

1. Open Insights
2. Filter by grade or month

**Collect Fee** — Take a fee payment at the counter.

1. Find the student
2. Pick the instalments
3. Choose the mode and reference
4. Collect — the receipt prints

**Fee Request Emails** — Send fee request emails by grade with a personal pay link.

1. Pick grades and instalment
2. Preview the email
3. Send

- *No email on file → SMS with the pay link.*

**Payment Matching** — Match incoming bank / UPI / gateway payments to fee requests.

1. New bank lines arrive
2. Matched ones are receipted automatically
3. Match the rest by hand

**Dues & Reminders** — Who owes what, with reminders.

1. Filter by grade or overdue
2. Send reminders
3. Open an invoice

**Receipts** — All receipts.

1. Search receipts
2. Reprint

**Fee Structure** — Fee heads and amounts per grade and instalment.

1. Pick the fee group
2. Edit fee heads and amounts

**Concessions** — Concessions and scholarships.

1. Add a concession to a student
2. The Principal approves

### 6.7 Transport

**Daily Bus Manifest** — Daily bus manifest: who boards, who doesn’t and why, for morning and afternoon.

1. Pick date, trip and route
2. See who boards at each stop
3. Mark Boarded / No-show (if switched on)
4. Send to the transport team

**Driver Route Sheets** — One route sheet per driver with stop timings and who to wait for.

1. Pick the date and Route #
2. Check the sheet
3. Send to all drivers (each gets only their route) or Send this route
4. Download all as Excel or print

**Pickup & Drop Changes** — Every request that changes the bus, today and coming days.

1. See every change that affects the bus, today and coming days

**Routes, Stops & Timings** — Routes, stops, timings, the route map and route planning.

1. Pick the route
2. Stops & timings: Edit timings, Add a stop, Move or Remove a stop
3. Plan the route: compare Shortest drive, Farthest stop first, Fewer stops → Use this route
4. Pickup suggestions: Move riders to a nearer stop, Add a suggested new stop
5. Route map: Add a stop by clicking the map, or Move a stop
6. Open driver route sheets

- *Times are worked out from the map so the bus still reaches school on time; you can still change any time in Edit timings.*
- *Tell parents before moving their child to another stop.*

### 6.8 Data Analytics

**Report Catalogue** — Catalogue of Power BI reports.

1. See every report, its filters and who it is for

**Top & Bottom Performers** — Top 6 and bottom 6 per grade.

1. Pick the grade
2. Optionally pick sections, term, subject
3. See top 6 and bottom 6

**Transport Reports** — Route use, cost per km, on-time and fee revenue.

1. Pick a grade
2. See riders, seats, revenue and on-time % per route

**Teacher Performance** — How each teacher’s students are doing.

1. Pick grade and subject
2. Compare each teacher’s classes with the grade
3. Share with teachers (optional)

**Admissions Funnel** — Admissions funnel and conversion.

1. Pick grade, source, year
2. Read the funnel

### 6.9 Payroll

**Run Payroll** — Monthly payroll.

1. Pick the month
2. Check each employee
3. Approve and post

**Payslips** — All payslips.

1. Pick the month
2. Open or email payslips

### 6.10 Accounts

**Account Statement** — Account statement with running balance.

1. Pick the account and dates
2. Read the running balance

**Income & Expenses** — Income and expenses.

1. Add income or expense
2. Filter by head

### 6.11 Campus Services

**Events & Calendar** — The school calendar: events, exams, parent meetings, circulars and holidays.

1. Open Events & Calendar
2. Add event: title, type, from/to, for everyone, parents or staff
3. Send to parents / staff
4. Tick Show past to look back

- *Holidays from the school calendar show here too.*
- *Parents see events for everyone and for parents; staff see staff events.*

**Homework** — Homework for each class, and who has done it. Parents see their child’s homework and status.

1. Pick the class
2. Set homework: subject, what to do, due date
3. Mark: Done, Late or Missing per student
4. Parents see it in the app with their child’s status

- *The bar shows how much of the class has handed it in.*

**Online Classes** — Live online classes with a Google Meet, Zoom or Teams link, and who attended.

1. Schedule a class: class, subject, date, time, minutes, meeting link
2. Coming up → Join
3. Held → Attendance

- *Links must start with https://. Two classes for the same class at the same time are refused.*
- *Growth plan and above, or the Online Classes add-on.*

**Library** — Library catalogue, issue and return, overdue books and fines.

1. Issue & return: find the student, pick a book, Issue
2. Return a book (fine worked out if late)
3. Catalogue → Add book
4. Overdue → Remind parent

- *14-day loans, ₹2 a day fine, up to 2 books per student; a student with an overdue book can’t borrow another.*
- *Growth plan and above, or the Library add-on.*

**Inventory & Store** — Uniforms, books and stationery: stock, sales to students, re-ordering.

1. Receive stock when a delivery comes
2. Sell to a student: find the student, item, quantity
3. Watch Re-order flags

- *You can’t sell more than is in stock.*
- *Professional plan and above, or the Inventory add-on.*

**Hostel** — Hostel blocks, rooms and beds, residents and monthly hostel fees.

1. See beds used and free per block
2. Give a bed: student → room with a free bed → mess yes or no
3. Vacate when a student leaves

- *Boys’ and girls’ blocks only offer rooms to the right students.*
- *Enterprise plan, or the Hostel add-on.*

### 6.12 Operations

**Users** — Accounts: filter by role, department and status, 25 to a page; see each parent’s student (admission no., name, grade), the created date and last sign-in; approve staff sign-ups, add users, change roles, designation and status; delete (the account moves to Archived).

1. Filter by role, department or status
2. Edit a person: role, designation, status, extra screens
3. Status Deleted → reason → confirm (moves to Archived)
4. Add user (Admin only, with a reason)

- *People normally register themselves; nobody waits for approval.*

**Roles & Permissions** — User management: profiles, departments and designations; add from the standard list for Indian schools or delete profiles. Permissions by department: No access, Read only or Full access for each main menu and sub-menu. Access summary: each person, their profile, department, designation and what they can open.

1. User management: profiles, departments, designations
2. Permissions by department: No access / Read only / Full access per menu
3. Access summary: what each person can open

**Data Import** — Load existing data with the conversion templates, or any Excel, CSV or photo.

1. Templates → download the template for what you are loading (or all of them)
2. Fill it in, keeping the headings; save it as NN_Name_Data_SCHOOL_YYYYMMDD.xlsx
3. New import → upload — the template is recognised from the file name
4. Students and Staff: map columns → check → import
5. Other templates: check every row against the template → ready to load
6. Import history → roll back if needed

- *Load in number order: classes before students, students before fees, marks and attendance.*
- *Old exports without the template still work for students and staff: map the columns once and save the mapping.*

**Help Documents & FAQs** — The school’s own help documents and FAQs.

1. Documents → Add a document: title, file or link, menu it belongs to, who can see it
2. FAQs → Add a question and answer for chosen roles
3. Edit or remove later

- *Documents and FAQs added here show in Help → FAQs and in the user guide, only to the roles you pick.*

### 6.13 My Space

**My Child** — Your child’s profile, attendance and results.

1. See your child’s profile: personal, academic, performance, attendance
2. Report cards → Open → Print / save as PDF

**Requests to School** — Send the school a request: leave, late arrival, pickup or drop in person, early leave, own transport, meet a teacher, certificate or query.

1. Pick the request type
2. Fill dates, person and reason
3. Send
4. Follow the status

**Fee Dues & Pay** — Fee dues and payment.

1. See dues
2. Pay online, or bank transfer with the UTR

**My Payslips** — Your payslips.

1. Pick the month
2. Open or download the payslip

**My Leave** — Your leave: what is left of each type, apply, and your requests.

1. See how much of each leave type is left
2. Apply: type, dates (or half day), reason → Send for approval
3. The approvers are notified
4. Follow the status in My requests; cancel if plans change

- *Casual leave is up to 3 days at a time; earned leave needs 7 days’ notice; sick leave can be applied after the day.*
- *Sundays and school holidays don’t count as leave days.*

**My Teaching Performance** — Your own teaching results (only when shared).

1. See your classes’ results against the grade

- *Only when the Principal or Head of Teaching Staff shares it.*

**My Account** — Your account: name, email or mobile, password, notifications, linked children; delete your account.

1. Change name, email or mobile (code to the new one)
2. Change password
3. Notification choices
4. Close the account

**My Preferences** — Your display preferences.

1. Choose light or dark, text size and your default templates

### 6.15 Platform Console

**Schools & Plans** — Platform Console: schools, plans, modules, functions and the mobile app switch.

1. Pick a school
2. Change plan, switch modules, sub-menus and functions
3. Mobile app on/off

- *Operations and Settings are always on.*

### 6.16 Service Provider

**Price List & Tiers** — Pricing: the Starter, Pro and Pro+ plans with price per student a year in bands, what a year costs by school size, a plan comparison, every add-on with its price, and the cost, margin and discount rules.

1. Three plan cards: price per student a year, from-price, what is included
2. Start with Starter / Choose Pro / Choose Pro+ starts a proposal
3. What a year costs by school size (type your size)
4. Price bands and one-time development
5. Compare the plans and the add-on list
6. Costs, margin and discount rules (internal)

- *Only the platform team and the Admin see Edit prices; Back to Pricing leaves without saving.*
- *Nothing is free: every price must be above zero.*

**Proposal Builder** — Priced proposals: client and point of contact, plan, add-ons, hosting and discount, with price, operating cost, gross margin, profit and the maximum discount worked out as you go.

1. New proposal
2. School and point of contact (name, email ID, contact number)
3. Plan: Starter, Pro or Pro+
4. Add-ons
5. Hosting, discount, GST
6. Watch price, margin and profit on the right
7. Preview PDF / Download PDF / Email proposal

- *The discount can’t go over the maximum shown; above 10% needs the owner’s approval.*
- *Untick “Show margin, profit and operating cost in the PDF” for a client-only copy.*

**Demo Builder** — Sets up a working demo school for a client visit in four steps, linked to a proposal: what you change here changes the proposal and the demo school.

1. Pick the client (or New client)
2. 1 Service provider: pre-filled, Change if needed
3. 2 School and point of contact
4. 3 Plan
5. 4 Add-ons and discount
6. Create demo school
7. Open as Principal / Teacher / Parent, follow the demo script
8. End demo (bar at the top)

- *Every change saves to the linked proposal and sets the demo school up again.*
- *Remove demo schools after the visit.*

**Client Delivery** — Client delivery: a won proposal becomes a client project — the school set up as sold, eight documents (scope, website, app build, hosting and AWS, data migration, testing, go-live, links register), a starter website page, and every link with its environment, version and date.

1. Convert to client (or set the proposal to Won)
2. Links: test build ready at once; fill in website, hosting, AWS and store placeholders
3. Documents: preview or download each PDF
4. Website: preview and download the starter page
5. Share with customer: pick links and documents → Send email
6. Proposal changed? Regenerate as the next version
7. Status: Onboarding → Customer testing → Live

- *The test build link carries the school's set-up, so the customer sees exactly what was sold in their own browser.*
- *Placeholder links can't be shared until they are filled in; every change keeps the old link with its version and date.*

**Competition Comparison** — Our features and price against Indian and global school software, with our edge and our gaps.

1. Enter the student count
2. Pick Indian, global or all providers, and a feature group
3. Read Our edge, Gaps to close and Price position
4. Open a source

- *? means the feature isn’t mentioned in the pages we read — it may still exist.*

**Market Review & Roadmap** — Indian and global market review (with each provider’s country) and the future enhancements we plan.

1. Indian market
2. Global market by country
3. What it means for us
4. Future enhancements: set priority and status

### 6.17 Settings

**Appearance & Branding** — Layout, colours and fonts.

1. Pick a layout template
2. Pick colours and font
3. Preview
4. Publish

**Website & Links** — Links between the app and the school website.

1. Connect the school website or host a new one
2. Copy link snippets
3. Add website pages to the menu

**Web & App Screens** — Which screens each role sees on the website, in the mobile app, or both.

1. Pick a role
2. Set each phone-ready screen to Website + app, Website only or App only
3. Send for approval
4. The Principal approves and publishes

**Templates** — Invoices, receipts, emails, payslips and letters in the school’s own format.

1. Pick a document type
2. Use standard, Copy & edit, or Upload
3. Make it the default for the school, a role or yourself

**Bank & Payment Details** — The school’s bank and UPI details shown on invoices.

1. Enter bank and UPI details
2. Send for approval
3. The Principal approves

- *The account number is stored encrypted.*

**SMS Gateway** — Connect an SMS provider (MSG91, Amazon SNS, Gupshup, Twilio or your own API).

1. Pick the provider
2. Enter the DLT template IDs
3. Dry run
4. Go live

**Email & SMS Outbox** — Every email and SMS the app has sent (test inbox).

1. See every email and SMS the app sent or queued

**Backups & Restore** — Backups & restore (add-on): nightly automatic backups kept 30 days, a backup on demand, and restore from a backup file.

1. See the last backup
2. Back up now (downloads the file)
3. Set the schedule and how long to keep
4. Restore from a backup file

- *Backups add-on (in Pro and Pro+). Only the Admin restores.*

### 6.18 Help

**User Guide & Demo** — This guide: guided demos, the screen-by-screen flow, every menu explained, and what each role sees — filtered to what your school has and you can open.

1. Guided demos → Start
2. Screen by screen → the flow for each menu you can open
3. Every menu explained
4. What each role sees

- *The guide shows only what your school has and you can open; switch the filter to see more.*

**FAQs** — Frequently asked questions for your role, and the school’s documents.

1. Search or pick a topic
2. Open a question
3. School documents at the bottom

## 7. Mobile app

- One app in Google Play and the App Store serves every school. On first open, enter the school code (from the school website or welcome email), then sign in with the same email or mobile and password as the website.
- The platform team switches the app on per school (Platform Console → Schools & Plans → Mobile app). New schools start with it off.
- Tabs follow section 3. More than five tabs: the extra ones are under **More**.
- Works offline with saved information; turn notifications on from Home.
- Parents delete their account in **Account → Delete my account**, or on the web at #/p/delete.

## 8. Moving data in: conversion templates

**Operations → Data Import → Templates.** Load in number order: classes before students, students before fees, marks and attendance, routes before riders. Blank template: `NN_Name_Data.xlsx`. Filled-in file: `NN_Name_Data_<SCHOOL>_<YYYYMMDD>.xlsx` — the app recognises the template from the name.

| No | File | Menu | Required columns | All columns |
| --- | --- | --- | --- | --- |
| 01 | 01_Class_Section_Data.xlsx | Academics → Classes & Sections | Class, Section, Board | 6 |
| 02 | 02_Student_Data.xlsx | Students → All Students | Admission no, First name, Date of birth, Gender, Class, Section, Guardian name, Guardian relation, Guardian mobile | 17 |
| 03 | 03_Guardian_Data.xlsx | Students → All Students (guardians) | Admission no, Guardian name, Relation, Mobile | 7 |
| 04 | 04_Staff_Data.xlsx | Staff → All Staff | Employee code, First name, Gender, Department, Designation, Employment type, Date of joining, Mobile | 12 |
| 05 | 05_Staff_Salary_Data.xlsx | Payroll → Run Payroll | Employee code, Basic | 9 |
| 06 | 06_Leave_Balance_Data.xlsx | Staff → Leave Requests | Employee code, Leave type, Days taken this year | 4 |
| 07 | 07_Fee_Structure_Data.xlsx | Fees → Fee Structure | Class, Fee head, Amount for the year, Instalments, First due date | 5 |
| 08 | 08_Fee_Payment_History_Data.xlsx | Fees → Receipts | Admission no, Receipt no, Date, Amount, Mode | 7 |
| 09 | 09_Fee_Concession_Data.xlsx | Fees → Concessions | Admission no, Concession | 5 |
| 10 | 10_Transport_Route_Data.xlsx | Transport → Routes, Stops & Timings | Route no, Route name, Bus registration, Seats, Driver name, Driver mobile, Reaches school (morning), Leaves school (afternoon) | 9 |
| 11 | 11_Transport_Stop_Data.xlsx | Transport → Routes, Stops & Timings | Route no, Stop order, Stop name (landmark), Morning pickup, Afternoon drop | 7 |
| 12 | 12_Student_Transport_Data.xlsx | Transport → Routes, Stops & Timings (riders) | Admission no, Route no, Stop name (landmark), Uses | 4 |
| 13 | 13_Subject_Teacher_Data.xlsx | Academics → Timetable | Class, Section, Subject, Employee code | 5 |
| 14 | 14_Timetable_Data.xlsx | Academics → Timetable | Class, Section, Day, Period, Subject, Employee code | 6 |
| 15 | 15_Exam_Marks_Data.xlsx | Students → Student Profile / Report Cards | Admission no, Exam, Subject, Marks obtained, Maximum marks | 5 |
| 16 | 16_Student_Attendance_Data.xlsx | Students → Attendance | Admission no, Date | 5 |
| 17 | 17_Staff_Attendance_Data.xlsx | Staff → Staff Attendance | Employee code, Date, Status | 3 |
| 18 | 18_Admission_Enquiry_Data.xlsx | Students → Admissions & Enquiries | Child name, Grade applied for, Parent name, Mobile, Status, Enquiry date | 8 |
| 19 | 19_Question_Bank_Data.xlsx | Exams → Question Bank | Class, Subject, Chapter, Type, Difficulty, Marks, Question | 10 |
| 20 | 20_Bus_Fleet_Data.xlsx | Dashboard → Transport | Bus registration, Seats, Status | 7 |

## 9. Frequently asked questions

In the app: **Help → FAQs** (each person sees the questions for their role, plus the school's own questions and documents from Operations → Help Documents & FAQs).

### Signing in

**I forgot my password. What do I do?**   
On the sign-in page choose “Forgot password”. A 6-digit code goes to your email (or by SMS once the school connects it). Enter it and set a new password. The school never emails passwords.

**My account is locked.**   
After 5 wrong passwords the account locks. Use “Sign in with a code” to unlock it yourself, or ask the school office.

**Registration says my details don’t match.** *(Parent)*  
Use the admission number, the student’s name as on school records and the current grade. After 5 tries, contact the school office — they can check the record.

**How do staff create an account?** *(Teacher, Principal, Accountant, Front Office, Transport team)*  
Register on the website or in the app with your employee code, your name and the mobile or email the school has on your staff record. The account opens at once with your role.

### Attendance

**How do I mark attendance?** *(Teacher, Principal, Admin)*  
Students → Attendance. Pick the section; everyone starts Present for today. Tap a cell to switch Present → Absent → Late, then Submit today’s attendance. Absent students’ guardians get an SMS.

**Can I correct an earlier day?** *(Teacher, Principal, Admin)*  
Yes — set the date range to include that day and tap the cell. Approved leave (L) can only change through the request.

**Why is a column grey?** *(Teacher, Principal, Admin)*  
Sundays and school holidays are greyed out and don’t count in the totals.

**Where do I see my child’s attendance?** *(Parent)*  
My Child → Attendance report: month by month, with the year’s percentage.

### Leave

**How much leave can I take?** *(Teacher, Principal, Accountant, Front Office, Transport team, Admin)*  
My Space → My Leave shows each leave type, how many days a year, what you have taken, what is waiting and what is left.

**Who approves my leave?** *(Teacher, Principal, Accountant, Front Office, Transport team, Admin)*  
Teaching staff: the Principal or the Vice Principal. Everyone else: the Principal or the Admin. They are told in the app (🔔) and by email, and you are told when they decide.

**Can I take a half day?** *(Teacher, Principal, Accountant, Front Office, Transport team, Admin)*  
Yes — tick Half day and pick one date. It counts as 0.5 of the leave type.

**How do I change how many days each leave type allows?** *(Principal, Admin)*  
Staff → Leave Requests → Leave types → Change allowances.

### Fees

**How do I pay fees?** *(Parent)*  
My Space → Fee Dues & Pay. Pay online, or pay by bank transfer and enter the UTR so the school can match it.

**I paid but it still shows due.** *(Parent)*  
Bank transfers show as paid once the bank line reaches the school, usually the next working day. If it’s longer, raise an Other request with the UTR.

**How are payments matched?** *(Accountant, Admin, Principal)*  
By the pay token in the fee email, then the admission number in the bank narration, then a unique amount. The rest wait in Payment Matching.

### Transport

**My child won’t take the bus today.** *(Parent)*  
Requests to School → Own transport (or In-person pickup). It’s confirmed at once and the driver’s sheet updates.

**How do I add a new stop?** *(Transport team, Admin, Principal)*  
Transport → Routes, Stops & Timings → pick the route → Add a stop, then click the map where it should be. The route order and times are worked out again.

**What does “Plan the route” do?** *(Transport team, Admin, Principal)*  
It compares the current order of stops with the shortest drive, farthest-stop-first and (where stops are close) fewer stops, with the minutes saved. Pick one and Use this route.

**Where do I record a bus breakdown?** *(Transport team, Admin, Principal)*  
Dashboard → Transport → Log a breakdown: date, route, what happened, delay and whether the spare bus covered it. Tick “taken off the road” to mark the bus Under repair until it is back in service.

### Results and report cards

**Where is the report card?** *(Parent)*  
My Child → Report cards → Open. Print it or save it as a PDF. You are notified when the school publishes one.

**How do I make report cards?** *(Teacher, Principal, Admin)*  
Students → Report Cards → pick grade, section, student (or all) and the term or exam → Generate → Print / save as PDF → Publish to parents.

**How is the rank worked out?** *(Teacher, Principal, Admin, Parent)*  
By the overall % across subjects for that exam or term, against everyone in the section and the grade. Equal scores share a rank.

### Requests to school

**How do I ask for an early leave?** *(Parent)*  
Requests to School → Early leave: time before 15:00, who collects (from your approved list) and the reason. A class coordinator approves and you get a gate code.

**How do I add someone who can collect my child?** *(Parent)*  
Requests to School → Approved pickup list → Add a person with a photo and the last 4 digits of a photo ID. The school checks the ID first.

### Users and access

**Why can’t someone see a menu?** *(Admin)*  
Check the school’s plan (Platform Console), their department’s access (Roles & Permissions → Permissions by department) and any read-only setting. The Access summary shows what each person can open.

**Someone left. How do I remove them?** *(Admin)*  
Operations → Users → Edit → Status Deleted → reason → confirm. A copy stays in the view-only archive.

### Data import

**How do we move from our old system?** *(Admin)*  
Operations → Data Import → Templates. Download the templates, fill them in the number order (01 first) and upload each one. File names follow NN_Name_Data_SCHOOL_YYYYMMDD.xlsx so the app knows what each file is.

**Can I undo an import?** *(Admin)*  
Yes — Import history → Roll back removes everything that import added.

### The app

**Is there a phone app?**   
Yes — one app on Google Play and the App Store for every school. Enter the school code once. Which screens show there is set by the school.

**Where are my notifications?**   
The bell 🔔 at the top shows what needs you (for example leave to approve) and decisions on your requests. Click one to open the screen.

### Campus

**Where do parents see homework?** *(Teacher, Principal, Admin, Parent)*  
Campus Services → Homework. Parents see their child’s class only, with Done, Late or Missing once the teacher marks it.

**Why can’t a student borrow a library book?** *(Teacher, Principal, Admin, Front Office)*  
A student can have 2 books at a time and can’t borrow while one is overdue. Return the overdue book first (the fine is shown).

**I don’t see Library, Hostel, Portfolios or Curriculum Planning.**   
They come with some plans or as add-ons the school buys: Homework from Pro; Portfolios and Curriculum Planning from Pro+; Library, Online Classes, Inventory and Hostel as add-ons. Ask the school office.

**How do parents get an event or circular?** *(Admin, Principal, Front Office)*  
Events & Calendar → add it → “Send to parents”. It appears in their app bell straight away.

### Sales and demos

**How do I price a school?** *(Sales & marketing, Platform team, Admin)*  
Service Provider → Price List & Tiers → Choose Starter, Pro or Pro+ (or Proposal Builder → New proposal). Enter the school, students and the point of contact, then the add-ons and any discount. The price, operating cost, margin, profit and the most discount allowed show on the right. Download PDF or Email proposal.

**How do I show a client their own set-up?** *(Sales & marketing, Platform team, Admin)*  
Demo Builder → pick the client (or New client) → check the service provider, the contact, the plan and add-ons → Create demo school → Open as Principal, Teacher or Parent. Anything you change there changes the proposal and the demo school too. End demo at the top brings you back.

**Can I change prices?** *(Sales & marketing, Platform team, Admin)*  
Only the platform team and the Admin can: Price List & Tiers → Edit prices → Save prices (Back to Pricing leaves without saving). Nothing can be free. Sales can give up to 10% discount, never more than the maximum the proposal shows; more than 10% needs the owner’s approval.

**What happens when a proposal is won?** *(Sales & marketing, Platform team, Admin)*  
Set it to Won or press Convert to client. Client Delivery then has the school set up as sold, eight documents (scope, website, app build, hosting and AWS, data migration, testing, go-live, links), a starter website page and every link with its version and date. Fill in placeholders as hosting and store builds go live, then Share with customer.

**Why does WhatsApp say “No service needed”?** *(Sales & marketing, Platform team, Admin)*  
WhatsApp messages go from the school’s phone to the parent’s phone (click to chat), not through our app or website, so there is no provider to pay. The add-on still has a price for the feature.
