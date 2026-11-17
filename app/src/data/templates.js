// Standard templates shipped with the platform. Schools copy and edit them, or upload their own.
// Placeholders: {{key}}; repeating rows: {{#items}} … {{/items}}

export const CATEGORIES = [
  { code: 'FEE_INVOICE', name: 'Fee invoice', module: 'Fees', output: 'A4' },
  { code: 'FEE_RECEIPT', name: 'Fee receipt', module: 'Fees', output: 'A4' },
  { code: 'FEE_REQUEST_EMAIL', name: 'Fee request email', module: 'Fees', output: 'Email' },
  { code: 'PAYMENT_CONFIRMATION_EMAIL', name: 'Payment confirmation email', module: 'Fees', output: 'Email' },
  { code: 'FEE_REMINDER_SMS', name: 'Fee reminder SMS', module: 'Fees', output: 'SMS' },
  { code: 'PAYSLIP', name: 'Payslip', module: 'Payroll', output: 'A4' },
  { code: 'ADMISSION_LETTER', name: 'Admission letter', module: 'Students', output: 'A4' },
  { code: 'APPRECIATION_CARD', name: 'Appreciation card', module: 'Exams', output: 'Card' }
];

export const FIELDS = {
  FEE_INVOICE: ['school_name', 'school_address', 'student_name', 'admission_no', 'program', 'instalment', 'invoice_no', 'invoice_date', 'due_date', 'items[sr, description, amount]', 'grand_total', 'previous_outstanding', 'advance', 'net_payable', 'net_payable_words', 'bank_details', 'pay_link'],
  FEE_RECEIPT: ['school_name', 'receipt_no', 'date', 'student_name', 'admission_no', 'program', 'amount', 'amount_words', 'mode', 'reference', 'items[description, amount]'],
  FEE_REQUEST_EMAIL: ['school_name', 'guardian_name', 'student_name', 'class', 'instalment', 'amount_due', 'due_date', 'pay_link', 'bank_details', 'admission_no'],
  PAYMENT_CONFIRMATION_EMAIL: ['school_name', 'guardian_name', 'student_name', 'amount', 'receipt_no', 'mode', 'reference', 'receipt_link'],
  FEE_REMINDER_SMS: ['school_short', 'student_first', 'amount_due', 'due_date', 'pay_link'],
  PAYSLIP: ['school_name', 'month', 'employee_name', 'employee_code', 'designation', 'items[component, earning, deduction]', 'gross', 'deductions', 'net', 'net_words'],
  ADMISSION_LETTER: ['school_name', 'date', 'guardian_name', 'student_name', 'class', 'admission_no', 'start_date'],
  APPRECIATION_CARD: ['title', 'message', 'student_name', 'month']
};

export const SAMPLE = {
  school_name: '[SCHOOL NAME]', school_address: '[Address line, District, City – PIN]', school_short: 'GVS',
  student_name: 'AARAV SHARMA', student_first: 'Aarav', admission_no: 'ADM-2025-0231', program: 'GRADE VIII', class: 'Grade VIII-A',
  instalment: 'Installment III', invoice_no: 'INV-GVS-08301', invoice_date: '01-12-2026', due_date: '10-12-2026',
  items: [{ sr: '1', description: 'Tuition', amount: '60,890.00', component: 'Basic', earning: '40,000', deduction: '' },
    { sr: '2', description: 'Dining', amount: '16,320.00', component: 'HRA', earning: '16,000', deduction: '' },
    { sr: '3', description: 'Transport', amount: '25,860.00', component: 'Provident fund', earning: '', deduction: '4,800' }],
  grand_total: '1,03,070.00', previous_outstanding: '0.00', advance: '0.00', net_payable: '1,03,070.00',
  net_payable_words: 'INR One Lakh, Three Thousand And Seventy only', amount_words: 'INR One Lakh, Three Thousand And Seventy only',
  bank_details: '[School] Educational Society · SBI MG Road · IFSC SBIN0001234 · UPI schoolfees@sbi', pay_link: 'https://greenvalley.yourapp.com/pay/7f3a…',
  guardian_name: 'Rohit Sharma', amount_due: '₹1,03,070', amount: '₹1,03,070', receipt_no: 'R-2026-00412', mode: 'UPI', reference: 'pay_Nf83kQ',
  receipt_link: 'https://greenvalley.yourapp.com/receipts/R-2026-00412', date: '05-12-2026', month: 'November 2026', employee_name: 'Priya Rao',
  employee_code: 'EMP-0187', designation: 'TGT — Science', gross: '61,600', deductions: '8,100', net: '53,500', net_words: 'Fifty Three Thousand, Five Hundred',
  start_date: '01-04-2027', title: 'Bravo!', message: 'For focus and care in the second-term assessments.'
};

const A4 = 'font-family:Inter,Arial,sans-serif;color:#14171C;font-size:13px;line-height:1.5';
export const STANDARD_TEMPLATES = [
  { id: 'STD-INV', category: 'FEE_INVOICE', name: 'Standard fee invoice (A4)', source: 'STANDARD', status: 'ACTIVE', version: 1,
    body: `<div style="${A4}">
<div style="display:flex;gap:12px;align-items:center;border-bottom:2px solid {{accent}};padding-bottom:10px"><div style="width:48px;height:40px;border-radius:6px;background:{{accent}};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">S</div><div><b style="font-size:16px">{{school_name}}</b><br><span style="font-size:11px">{{school_address}}</span></div></div>
<h3 style="text-align:center;letter-spacing:.2em">FEES</h3>
<table style="width:100%;font-size:12px"><tr><td>Student Name:</td><td><b>{{student_name}}</b></td><td>Fee Invoice No:</td><td><b>{{invoice_no}}</b></td></tr>
<tr><td>Admission No:</td><td>{{admission_no}}</td><td>Date:</td><td>{{invoice_date}}</td></tr>
<tr><td>Program:</td><td>{{program}}</td><td>Due Date:</td><td>{{due_date}}</td></tr><tr><td>Installment:</td><td>{{instalment}}</td></tr></table>
<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr style="border-bottom:1px solid #14171C"><th align="left">Sr</th><th align="left">Description</th><th align="right">Amount</th></tr>
{{#items}}<tr style="border-bottom:1px solid #E3E6EB"><td>{{sr}}</td><td>{{description}}</td><td align="right">₹ {{amount}}</td></tr>{{/items}}</table>
<p style="text-align:right">Grand Total: <b>₹ {{grand_total}}</b></p><p>Previous Outstanding Amount: ₹ {{previous_outstanding}}<br>Total Advance: ₹ {{advance}}</p>
<p style="font-size:15px"><b>Net Payable: ₹ {{net_payable}}</b></p><p>Net Payable Amount (in words): {{net_payable_words}}</p>
<div style="border:1px solid {{accent}};border-radius:8px;padding:8px 10px;font-size:12px"><b>How to pay</b><br>{{bank_details}}<br>Online: {{pay_link}} · quote {{admission_no}} in remarks</div>
<p style="text-align:center;font-size:11px;font-style:italic">This is a Computer Generated Statement and Does Not Require a Signature</p></div>` },
  { id: 'STD-RCPT', category: 'FEE_RECEIPT', name: 'Standard fee receipt', source: 'STANDARD', status: 'ACTIVE', version: 1,
    body: `<div style="${A4}"><h2 style="margin:0">{{school_name}}</h2><h3 style="text-align:center">FEE RECEIPT</h3>
<p>Receipt No: <b>{{receipt_no}}</b> · Date: {{date}}</p><p>Received from the parent of <b>{{student_name}}</b> ({{admission_no}}, {{program}}) the sum of <b>{{amount}}</b> ({{amount_words}}) by {{mode}} {{reference}}.</p>
<table style="width:100%;border-collapse:collapse">{{#items}}<tr style="border-bottom:1px solid #E3E6EB"><td>{{description}}</td><td align="right">₹ {{amount}}</td></tr>{{/items}}</table>
<p style="font-size:11px;font-style:italic">Computer generated receipt — no signature required.</p></div>` },
  { id: 'STD-REQ', category: 'FEE_REQUEST_EMAIL', name: 'Standard fee request email', source: 'STANDARD', status: 'ACTIVE', version: 1,
    subject: 'Fee due: {{student_name}} ({{class}}) — {{amount_due}} by {{due_date}}',
    body: `<p>Dear {{guardian_name}},</p><p>The {{instalment}} fee for {{student_name}} ({{class}}) of <b>{{amount_due}}</b> is due on <b>{{due_date}}</b>.</p>
<p><a href="{{pay_link}}" style="background:{{accent}};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Pay now</a></p>
<p>Or pay by bank transfer / UPI: {{bank_details}}. Please write <b>{{admission_no}}</b> in the remarks.</p><p>Thank you,<br>Accounts Office, {{school_name}}</p>` },
  { id: 'STD-CONF', category: 'PAYMENT_CONFIRMATION_EMAIL', name: 'Standard payment confirmation', source: 'STANDARD', status: 'ACTIVE', version: 1,
    subject: 'Payment received — {{student_name}} ({{receipt_no}})',
    body: `<p>Dear {{guardian_name}},</p><p>We have received <b>{{amount}}</b> towards fees for {{student_name}}.</p><p>Receipt: {{receipt_no}} · {{mode}} · ref {{reference}}<br><a href="{{receipt_link}}">Download receipt</a></p><p>Thank you,<br>{{school_name}}</p>` },
  { id: 'STD-SMS', category: 'FEE_REMINDER_SMS', name: 'Standard fee reminder SMS', source: 'STANDARD', status: 'ACTIVE', version: 1,
    body: '{{school_short}}: Fee of {{amount_due}} for {{student_first}} is due {{due_date}}. Pay: {{pay_link}}' },
  { id: 'STD-PAY', category: 'PAYSLIP', name: 'Standard payslip', source: 'STANDARD', status: 'ACTIVE', version: 1,
    body: `<div style="${A4}"><h2 style="margin:0">{{school_name}}</h2><h3>Payslip — {{month}}</h3><p>{{employee_name}} · {{employee_code}} · {{designation}}</p>
<table style="width:100%;border-collapse:collapse"><tr><th align="left">Component</th><th align="right">Earning</th><th align="right">Deduction</th></tr>{{#items}}<tr style="border-top:1px solid #E3E6EB"><td>{{component}}</td><td align="right">{{earning}}</td><td align="right">{{deduction}}</td></tr>{{/items}}</table>
<p>Gross {{gross}} · Deductions {{deductions}} · <b>Net {{net}}</b> ({{net_words}})</p></div>` },
  { id: 'STD-ADM', category: 'ADMISSION_LETTER', name: 'Standard admission letter', source: 'STANDARD', status: 'ACTIVE', version: 1,
    body: `<div style="${A4}"><h2 style="margin:0">{{school_name}}</h2><p>{{date}}</p><p>Dear {{guardian_name}},</p><p>We are pleased to confirm the admission of <b>{{student_name}}</b> to <b>{{class}}</b> (admission no. {{admission_no}}). Classes begin on {{start_date}}.</p><p>Principal</p></div>` },
  { id: 'STD-CARD', category: 'APPRECIATION_CARD', name: 'Appreciation card — border', source: 'STANDARD', status: 'ACTIVE', version: 1,
    body: `<div style="border:8px double #3A404B;padding:24px;text-align:center;font-family:Georgia,serif"><h2 style="margin:0">{{title}}</h2><p style="font-size:18px">{{message}}</p><p>{{student_name}} · {{month}}</p><div style="display:flex;justify-content:space-between;font-size:11px"><span>Coordinator</span><span>Vice Principal</span></div></div>` }
];

// {{key}} and one repeating {{#items}}…{{/items}} block — same rules as render_template() in the database
export function renderTemplate(body = '', data = {}) {
  let out = body;
  const s = out.indexOf('{{#items}}'), e = out.indexOf('{{/items}}');
  if (s >= 0 && e > s) {
    const blk = out.slice(s + 10, e);
    const rows = (data.items || []).map((it) => blk.replace(/\{\{(\w+)\}\}/g, (m, k) => (it[k] ?? '')));
    out = out.slice(0, s) + rows.join('') + out.slice(e + 10);
  }
  return out.replace(/\{\{(\w+)\}\}/g, (m, k) => (data[k] !== undefined && typeof data[k] !== 'object' ? String(data[k]) : m));
}

// Basic HTML clean-up for templates written by schools (no scripts, no event handlers, no external frames)
export function sanitize(html = '') {
  return html
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}
