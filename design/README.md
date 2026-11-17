# Screen designs

Live design canvas: https://claude.ai/artifact/FHW9v2kHKtoA72u4pH6GuD

`canvas/` holds the canvas source: one `.dc.html` file per artboard plus `canvas.json` (layout). Artboards cover the sidebar, dashboard, admission, staff, fee collection, payroll, account statement, user management, parent and teacher mobile screens, SaaS architecture, plans matrix, configuration console, insights, exam paper builder and preview, approved papers, question bank, syllabus library, paper formats, co-scholastic grades, appearance and theme architecture, bank details, fee request email, parent pay page, payment matching, website links, timetable, fee structure, invoice template and student profile.

The client review PDF (`docs/School_Platform_Client_Review.pdf`) lists every menu, sub-menu and column for sign-off. Regenerate it with `python3 tools/pdf/build.py docs/School_Platform_Client_Review.pdf` (needs `reportlab` and DejaVu fonts).
