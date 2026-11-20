// Proposal PDF, laid out like a modern Indian school-software pricing page: a short intro, three plan cards with
// the chosen one marked, what a year costs by school size, a plan comparison, then this school's offering,
// price, discount and commercial summary, a few questions answered and a closing call to contact us.
import { jsPDF } from 'jspdf';
import { CARLITO_REGULAR, CARLITO_BOLD } from './pdfFonts.js';
import { saveFile } from './saveFile.js';
import { GST, quote, offering, tierOf, basePrice, yearCost, SIZES, BASIC, bandLabel, rupees, pct, OVERHEAD_NAMES } from './pricing.js';

const C = { green: [31, 77, 63], tint: [234, 242, 238], ink: [29, 42, 38], muted: [91, 107, 102], line: [217, 226, 222], white: [255, 255, 255], amber: [180, 110, 20] };
const W = 210; const H = 297; const M = 16; const CW = W - 2 * M;
const dmy = (d) => new Date((d || '').length === 10 ? d + 'T00:00:00' : d || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function buildProposalPdf({ proposal, rc, profile }) {
  const o = proposal.options;
  const q = quote(rc, o);
  const off = offering(rc, o);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Carlito-Regular.ttf', CARLITO_REGULAR); doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
  doc.addFileToVFS('Carlito-Bold.ttf', CARLITO_BOLD); doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
  doc.setProperties({ title: `Proposal ${proposal.no} — ${o.client}`, author: profile.name, subject: `${q.tier.name} plan proposal`, creator: profile.product });
  let y = 0;
  const school = o.client || 'your school';

  // ---------- drawing helpers
  const font = (size, bold = false, color = C.ink) => { doc.setFont('Carlito', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  const lh = (size) => size * 0.42;
  const text = (s, x, yy, opt) => doc.text(String(s), x, yy, opt);
  const para = (s, x, width, size = 10.5, bold = false, color = C.ink, gap = 1.6) => {
    font(size, bold, color); const lines = doc.splitTextToSize(String(s), width);
    lines.forEach((l) => { need(lh(size) + 1); text(l, x, y); y += lh(size) + gap; });
  };
  const bullet = (s, x, width, size = 10, color = C.ink) => {
    font(size, false, color); const lines = doc.splitTextToSize(String(s), width - 4);
    lines.forEach((l, i) => { need(lh(size) + 1); if (!i) text('•', x, y); text(l, x + 4, y); y += lh(size) + 1.2; });
  };
  const header = () => {
    doc.setFillColor(...C.green); doc.rect(0, 0, W, 14, 'F');
    font(11, true, C.white); text(profile.name, M, 9);
    font(9, false, C.white); text(`Proposal ${proposal.no} · ${dmy(proposal.created)}`, W - M, 9, { align: 'right' });
    y = 22;
  };
  const need = (h) => { if (y + h > H - 18) { doc.addPage(); header(); } };
  const h2 = (s, sub) => {
    need(34); y += 3; font(16, true, C.green); text(s, M, y); y += 2.5;
    doc.setDrawColor(...C.green); doc.setLineWidth(0.6); doc.line(M, y, M + 18, y); y += 5;
    if (sub) para(sub, M, CW, 9.5, false, C.muted);
  };
  const rule = (yy, color = C.line, w = 0.25) => { doc.setDrawColor(...color); doc.setLineWidth(w); doc.line(M, yy, W - M, yy); };
  // Table: cols [{ label, w, align }], rows of strings; opts.bold(rowIndex), opts.fill(rowIndex)
  const table = (cols, rows, opts = {}) => {
    const size = opts.size || 9.5; const pad = 2.2;
    const xs = []; let x = M; cols.forEach((c) => { xs.push(x); x += c.w; });
    const drawHead = () => {
      need(9); doc.setFillColor(...C.tint); doc.rect(M, y - 4.6, CW, 7.2, 'F');
      font(size, true, C.green); cols.forEach((c, i) => text(c.label, c.align === 'right' ? xs[i] + c.w - pad : xs[i] + pad, y, { align: c.align === 'right' ? 'right' : 'left' })); y += 6;
    };
    drawHead();
    rows.forEach((r, ri) => {
      const bold = opts.bold?.(ri); font(size, bold, opts.color?.(ri) || C.ink);
      const wrapped = r.map((cell, i) => doc.splitTextToSize(String(cell), cols[i].w - 2 * pad));
      const h = Math.max(...wrapped.map((w) => w.length)) * (lh(size) + 0.9) + 2.2;
      if (y + h > H - 18) { doc.addPage(); header(); drawHead(); font(size, bold, opts.color?.(ri) || C.ink); }
      if (opts.fill?.(ri)) { doc.setFillColor(...C.tint); doc.rect(M, y - 4.4, CW, h, 'F'); }
      wrapped.forEach((lines, i) => lines.forEach((l, li) => text(l, cols[i].align === 'right' ? xs[i] + cols[i].w - pad : xs[i] + pad, y + li * (lh(size) + 0.9), { align: cols[i].align === 'right' ? 'right' : 'left' })));
      y += h; rule(y - 4.4);
    });
    y += 3;
  };
  const pill = (s, x, yy, filled) => {
    font(9.5, true, filled ? C.white : C.green); const w = doc.getTextWidth(s) + 8;
    doc.setDrawColor(...C.green); doc.setLineWidth(0.4); if (filled) { doc.setFillColor(...C.green); doc.roundedRect(x, yy - 4.6, w, 7, 3.5, 3.5, 'FD'); } else doc.roundedRect(x, yy - 4.6, w, 7, 3.5, 3.5, 'S');
    text(s, x + 4, yy); return w;
  };

  // ================================================== Page 1: intro and plans
  header();
  font(8.5, false, C.muted); text(`Home  ›  Pricing  ›  Proposal for ${school}`, M, y); y += 9;
  font(24, true, C.ink); doc.splitTextToSize(`A proposal for ${school}`, CW).forEach((l) => { text(l, M, y); y += 9.5; });
  y += 1;
  para(`Dear ${o.poc?.name || 'Sir / Madam'}, thank you for your time. ${profile.name} is pleased to propose ${profile.product} for ${school}${o.city ? ', ' + o.city : ''}. ${profile.about}`, M, CW, 11, false, C.ink, 1.9);
  y += 1;
  para(`We recommend the ${q.tier.name} plan for ${q.students.toLocaleString('en-IN')} students${o.board ? ' (' + o.board + ')' : ''}. This proposal sets out what is included, the price for one year, and how to get started.`, M, CW, 11, false, C.ink, 1.9);
  y += 3;
  // Prepared for / by
  need(26); doc.setFillColor(...C.tint); doc.roundedRect(M, y - 4, CW, 22, 2, 2, 'F');
  const half = CW / 2;
  font(8.5, true, C.green); text('PREPARED FOR', M + 4, y + 1); text('PREPARED BY', M + half + 4, y + 1);
  font(10.5, true); text(o.poc?.name || school, M + 4, y + 6.5); text(profile.contact, M + half + 4, y + 6.5);
  font(9.5, false, C.muted);
  text([o.poc?.designation, school].filter(Boolean).join(', '), M + 4, y + 11.5); text(profile.name, M + half + 4, y + 11.5);
  text([o.poc?.email, o.poc?.phone].filter(Boolean).join(' · ') || '—', M + 4, y + 16); text(`${profile.email} · ${profile.phone}`, M + half + 4, y + 16);
  y += 25;

  // Three plan cards
  const gap = 4; const cardW = (CW - 2 * gap) / 3; const top = y + 4;
  const featuresFor = (t, i) => (i === 0 ? BASIC.map((b) => b[1]) : t.includes.filter((c) => !rc.tiers[i - 1].includes.includes(c)).map((c) => rc.addons.find((a) => a.code === c)?.name).filter(Boolean));
  const cards = rc.tiers.map((t, i) => {
    font(9); const feats = featuresFor(t, i).flatMap((f) => doc.splitTextToSize(f, cardW - 12).map((l, k) => [k === 0, l]));
    const tag = doc.splitTextToSize(t.tagline, cardW - 8);
    return { t, i, feats, tag, h: 62 + tag.length * 4.2 + feats.length * 4.1 + (i ? 5 : 0) };
  });
  const cardH = Math.max(...cards.map((c) => c.h));
  if (top + cardH > H - 18) { doc.addPage(); header(); }
  const ty = Math.max(top, y + 4);
  cards.forEach(({ t, i, feats, tag }) => {
    const x = M + i * (cardW + gap); const chosen = t.code === q.tier.code;
    doc.setLineWidth(chosen ? 0.9 : 0.3); doc.setDrawColor(...(chosen ? C.green : C.line)); doc.setFillColor(...C.white); doc.roundedRect(x, ty, cardW, cardH, 2.5, 2.5, 'FD');
    if (chosen || t.pick) { doc.setFillColor(...(chosen ? C.green : C.tint)); doc.roundedRect(x, ty, cardW, 7, 2.5, 2.5, 'F'); doc.rect(x, ty + 3.5, cardW, 3.5, 'F');
      font(8.5, true, chosen ? C.white : C.green); text(chosen ? 'YOUR PLAN' : 'Our pick for most schools', x + cardW / 2, ty + 4.8, { align: 'center' }); }
    let cy = ty + 14;
    font(15, true, C.ink); text(t.name, x + 4, cy); cy += 5;
    font(9, false, C.muted); tag.forEach((l) => { text(l, x + 4, cy); cy += 4.2; });
    cy += 4; font(19, true, C.green); text(rupees(t.rates[0]), x + 4, cy);
    const pw = doc.getTextWidth(rupees(t.rates[0])); font(8.5, false, C.muted); text('per student / year', x + 6 + pw, cy);
    cy += 4.8; font(9, false, C.muted); text(`about ${rupees(t.rates[0] / 12)} a child a month`, x + 4, cy);
    cy += 4.6; text(`from ${rupees(basePrice(rc, t.code))} a year`, x + 4, cy);
    cy += 7; pill(chosen ? 'Selected' : i === 0 ? 'Start with Starter' : `Choose ${t.name}`, x + 4, cy, chosen);
    cy += 8; doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(x + 4, cy - 3, x + cardW - 4, cy - 3);
    if (i) { font(9, true, C.ink); text(`Everything in ${rc.tiers[i - 1].name}, plus:`, x + 4, cy + 1); cy += 5; }
    font(9, false, C.ink); feats.forEach(([first, l]) => { if (first) text('•', x + 4, cy + 1); text(l, x + 7.5, cy + 1); cy += 4.1; });
  });
  y = ty + cardH + 8;
  para(`Per-student rates fall as the school grows: ${rc.bands.map((b, i) => `${bandLabel(b)} students at ${rupees(q.tier.rates[i])}`).join(', ')} (${q.tier.name}). Schools under ${rc.minStudents} students pay for ${rc.minStudents}.`, M, CW, 9, false, C.muted);

  // ================================================== What a year costs + compare
  h2('What a year costs', `Plan price and data storage for one academic year, before ${GST}% GST, by school size. Add-ons are extra. Billing is once per academic year.`);
  const sizes = [...new Set([...SIZES, q.students])].filter((n) => n > 0).sort((a, b) => a - b);
  table([{ label: 'Children', w: 46 }, ...rc.tiers.map((t) => ({ label: t.name, w: (CW - 46) / 3, align: 'right' }))],
    sizes.map((n) => [n === q.students ? `${n.toLocaleString('en-IN')} (${school})` : n <= rc.minStudents ? `${rc.minStudents} or fewer` : n.toLocaleString('en-IN'), ...rc.tiers.map((t) => rupees(yearCost(rc, t.code, n)))]),
    { fill: (ri) => sizes[ri] === q.students, bold: (ri) => sizes[ri] === q.students });

  h2('Compare the plans');
  const mark = (t, code) => (t.includes.includes(code) ? 'Yes' : 'Add-on');
  const cmpRows = [...BASIC.map((b) => [b[1], 'Yes', 'Yes', 'Yes']),
    ...rc.addons.filter((a) => rc.tiers.some((t) => t.includes.includes(a.code))).map((a) => [a.name, ...rc.tiers.map((t) => mark(t, a.code))]),
    ['Support', ...rc.tiers.map((t) => t.support)]];
  table([{ label: 'Feature', w: 82 }, ...rc.tiers.map((t) => ({ label: t.name, w: (CW - 82) / 3 }))], cmpRows, { size: 9 });
  para('“Add-on” means it can be added to that plan for an extra price. Upgrading the plan at any time switches its features on straight away.', M, CW, 9, false, C.muted);

  // ================================================== This school's offering
  h2(`What ${school} gets`, `${q.tier.name} plan with the add-ons chosen for the school.`);
  const group = (title, items) => { if (!items.length) return; need(12); font(11, true, C.green); text(title, M, y); y += 5.5; items.forEach(([n, d]) => bullet(n + (d ? ' — ' + d : ''), M + 2, CW - 2)); y += 2; };
  group('Included in every plan', off.basic.map((b) => [b.label, '']));
  group(`Included in ${q.tier.name}`, off.inTier.map((a) => [a.name, a.desc + (a.provider === 'No service needed' ? ' (no service needed)' : '')]));
  group('Add-ons for your school', off.chosen.map((a) => [a.name, a.desc + (a.provider ? ` (${a.provider === 'No service needed' ? 'no service needed: ' + a.providerNote.toLowerCase() : 'needs: ' + a.provider})` : '')]));
  para(`Hosting: ${rc.hosting.find((h) => h.code === (o.hosting || 'SHARED')).name}. Support: ${q.tier.support}. The phone app is free for every parent and staff member.`, M, CW, 9.5, false, C.muted);

  // ================================================== Price
  h2('Your price', `For ${q.students.toLocaleString('en-IN')} students. Amounts in rupees, before GST.`);
  const rows = q.lines.map((l) => [l.label, l.included ? `Included (worth ${rupees(l.listValue)})` : rupees(l.amount)]);
  if (q.discount) rows.push([`Discount ${pct(q.discountPct)} on the plan and add-ons`, rupees(-q.discount)]);
  rows.push(['Total a year', rupees(q.recurring)]);
  table([{ label: 'Every year', w: CW - 52 }, { label: 'Amount', w: 52, align: 'right' }], rows, { bold: (ri) => ri === rows.length - 1, fill: (ri) => ri === rows.length - 1 });
  // Bands for the plan line
  para(`${q.tier.name} plan by band: ${q.bands.map((b) => `${b.qty.toLocaleString('en-IN')} × ${rupees(b.rate)}`).join(' + ')} = ${rupees(q.lines[0].amount)}.`, M, CW, 9, false, C.muted);
  const once = q.oneTime.map((l) => [l.label, l.included ? 'Included' : rupees(l.amount)]);
  once.push(['Total one-time', rupees(q.oneTimeTotal)]);
  table([{ label: 'One-time (development and set-up)', w: CW - 52 }, { label: 'Amount', w: 52, align: 'right' }], once, { bold: (ri) => ri === once.length - 1, fill: (ri) => ri === once.length - 1 });
  const inv = [['Year one: one year + one-time', rupees(q.yearOne)], ...q.gstSplit.map(([k, v]) => [k, rupees(v)]), ['Year one total with GST', rupees(q.yearOneTotal)],
    ['From year two (a year, before GST)', rupees(q.recurring)], ['Per student a year (before GST)', rupees(q.perStudentYear)], ['Monthly equivalent', rupees(q.monthly)]];
  table([{ label: 'Summary', w: CW - 52 }, { label: 'Amount', w: 52, align: 'right' }], inv, { bold: (ri) => ri === 3, fill: (ri) => ri === 3 });

  // ================================================== Discount and commercial summary
  const e = q.economics;
  h2('Discount', null);
  table([{ label: 'Discount', w: CW - 52 }, { label: '', w: 52, align: 'right' }], [
    ['Discount applied to this proposal', q.discount ? `${pct(q.discountPct)} (${rupees(q.discount)})` : 'None'],
    ['Maximum allowable discount for this proposal', pct(e.maxDiscountPct)],
    ['Discount the sales team can approve', `up to ${pct(e.salesDiscount)}`]]);
  if (o.showInternal !== false) {
    h2('Commercial summary', `How the price covers the cost of running the service. Gross margin is compared with the industry standard for software-as-a-service companies (${e.industry[0]}–${e.industry[1]}%).`);
    table([{ label: 'A year, after discount', w: CW - 52 }, { label: 'Amount', w: 52, align: 'right' }], [
      ['Revenue', rupees(e.revenue)],
      ['Running cost: cloud, data storage, email, outside services, support', rupees(e.runningCost)],
      ...Object.entries(e.overheads).map(([k, v]) => [`${OVERHEAD_NAMES[k]} (${rc.economics.overheads[k]}% of list price)`, rupees(v)]),
      ['Operating cost', rupees(e.operatingCost)],
      ['Profit', `${rupees(e.profit)} (${pct(e.profitPct)})`],
      [`Gross margin (industry standard ${e.industry[0]}–${e.industry[1]}%)`, `${pct(e.grossMarginPct)} · ${e.marginStatus.toLowerCase()} the standard`],
      ['One-time development: price / cost / profit', `${rupees(e.oneTimeRevenue)} / ${rupees(e.oneTimeCost)} / ${rupees(e.oneTimeProfit)}`]
    ], { bold: (ri) => ri === 5 || ri === 6, fill: (ri) => ri === 6 });
    para(`The maximum discount keeps profit at or above ${e.profitFloor}% after operating cost, and never goes over ${rc.maxDiscount}%.`, M, CW, 9, false, C.muted);
  }

  // ================================================== Questions and closing call to action
  h2('Questions schools ask');
  [['Do parents pay for the app?', 'No. The phone app is free for parents and staff on every plan.'],
    ['Can we leave and take our data?', 'Yes. The school owns its data and can export every table as a spreadsheet at any time.'],
    ['Can we start small and upgrade later?', `Yes. Start on any plan and move up at any time; nothing to migrate. Payment is due within 15 days of the invoice. This proposal is valid for 30 days.`]]
    .forEach(([qq, a]) => { need(14); para(qq, M, CW, 10.5, true); para(a, M, CW, 10, false, C.ink); y += 1.5; });

  need(46); y += 4;
  doc.setFillColor(...C.green); doc.roundedRect(M, y, CW, 40, 3, 3, 'F');
  font(16, true, C.white); text(`Ready when ${school} is`, M + 8, y + 11);
  font(10.5, false, C.white);
  doc.splitTextToSize(`We would be glad to show ${school} a working demo set up for your school, and to answer any questions. Please contact ${profile.contact} at ${profile.name}.`, CW - 16).forEach((l, i) => text(l, M + 8, y + 18 + i * 5));
  font(10.5, true, C.white); text(`${profile.phone}   ·   ${profile.email}   ·   ${profile.website.replace(/^https?:\/\//, '')}`, M + 8, y + 34);
  y += 46;

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); rule(H - 13);
    font(8, false, C.muted);
    text(`${profile.name} · ${profile.city} · ${profile.website.replace(/^https?:\/\//, '')}`, M, H - 8.5);
    text(`Prices in Indian rupees, before ${GST}% GST · Page ${i} of ${pages}`, W - M, H - 8.5, { align: 'right' });
  }
  return doc;
}

export const proposalFileName = (p) => `${p.no}-${String(p.options.client || 'school').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;

export async function downloadProposalPdf(args) {
  const doc = buildProposalPdf(args);
  return saveFile(proposalFileName(args.proposal), doc.output('blob'));
}
export const proposalPdfBytes = (args) => buildProposalPdf(args).output('arraybuffer');
