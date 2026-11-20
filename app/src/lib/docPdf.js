// Client delivery documents as PDFs, in the same look as the proposal: green header with the provider's name,
// title block with version and date, sections of paragraphs, bullets and tables, and a footer on every page.
import { jsPDF } from 'jspdf';
import { CARLITO_REGULAR, CARLITO_BOLD } from './pdfFonts.js';
import { saveFile } from './saveFile.js';

const C = { green: [31, 77, 63], tint: [234, 242, 238], ink: [29, 42, 38], muted: [91, 107, 102], line: [217, 226, 222], white: [255, 255, 255] };
const W = 210; const H = 297; const M = 16; const CW = W - 2 * M;
const dmy = (d) => new Date((d || '').length === 10 ? d + 'T00:00:00' : d || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function buildDocPdf(docData, profile) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Carlito-Regular.ttf', CARLITO_REGULAR); doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
  doc.addFileToVFS('Carlito-Bold.ttf', CARLITO_BOLD); doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
  doc.setProperties({ title: `${docData.title} — ${docData.client} — v${docData.version}`, author: profile.name });
  let y = 0;
  const font = (size, bold = false, color = C.ink) => { doc.setFont('Carlito', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  const lh = (size) => size * 0.42;
  const header = () => {
    doc.setFillColor(...C.green); doc.rect(0, 0, W, 14, 'F');
    font(11, true, C.white); doc.text(profile.name || '', M, 9);
    font(9, false, C.white); doc.text(`${docData.projectNo} · ${docData.title} · v${docData.version}`, W - M, 9, { align: 'right' });
    y = 22;
  };
  const need = (h) => { if (y + h > H - 18) { doc.addPage(); header(); } };
  const para = (s, size = 10.5, bold = false, color = C.ink, x = M, width = CW) => { font(size, bold, color); doc.splitTextToSize(String(s), width).forEach((l) => { need(lh(size) + 1); doc.text(l, x, y); y += lh(size) + 1.6; }); };
  const table = ({ cols, rows }) => {
    const n = cols.length; const size = 9.2; const pad = 2;
    // Column widths by content length, at least 18 mm
    const len = cols.map((c, i) => Math.max(String(c).length, ...rows.map((r) => Math.min(60, String(r[i] ?? '').length))) + 4);
    const total = len.reduce((a, b) => a + b, 0);
    const w = len.map((l) => Math.max(18, CW * l / total)); const scale = CW / w.reduce((a, b) => a + b, 0); const ws = w.map((x) => x * scale);
    const xs = ws.map((_, i) => M + ws.slice(0, i).reduce((a, b) => a + b, 0));
    const head = () => { if (cols.every((c) => !c)) return; need(9); doc.setFillColor(...C.tint); doc.rect(M, y - 4.6, CW, 7, 'F'); font(size, true, C.green); cols.forEach((c, i) => doc.text(String(c), xs[i] + pad, y)); y += 6; };
    head();
    rows.forEach((r) => {
      font(size); const wrapped = r.map((cell, i) => doc.splitTextToSize(String(cell ?? ''), ws[i] - 2 * pad));
      const h = Math.max(1, ...wrapped.map((x) => x.length)) * (lh(size) + 0.9) + 2.2;
      if (y + h > H - 18) { doc.addPage(); header(); head(); font(size); }
      wrapped.forEach((lines, i) => { font(size, i === 0 && cols[0] === ''); lines.forEach((l, k) => doc.text(l, xs[i] + pad, y + k * (lh(size) + 0.9))); });
      y += h; doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(M, y - 4.4, W - M, y - 4.4);
    });
    y += 3;
  };
  header();
  font(8.5, false, C.muted); doc.text(`${docData.client} › ${docData.projectNo}`, M, y); y += 9;
  font(22, true); doc.splitTextToSize(docData.title, CW).forEach((l) => { doc.text(l, M, y); y += 9; });
  font(10.5, false, C.muted); doc.text(`${docData.client} · Version ${docData.version} · ${dmy(docData.date)}`, M, y); y += 8;
  docData.sections.forEach((s) => {
    need(26); y += 2; font(14, true, C.green); doc.text(s.h, M, y); y += 2.2; doc.setDrawColor(...C.green); doc.setLineWidth(0.5); doc.line(M, y, M + 16, y); y += 5.5;
    if (s.p) para(s.p);
    if (s.bullets) s.bullets.forEach((b) => { font(10); doc.splitTextToSize(String(b), CW - 6).forEach((l, i) => { need(6); if (!i) doc.text('•', M + 1, y); doc.text(l, M + 5, y); y += lh(10) + 1.3; }); });
    if (s.table) { y += 1; table(s.table); }
    y += 2;
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(M, H - 13, W - M, H - 13);
    font(8, false, C.muted); doc.text(`${profile.name} · ${profile.email} · ${profile.phone}`, M, H - 8.5);
    doc.text(`Version ${docData.version} · ${dmy(docData.date)} · Page ${i} of ${pages}`, W - M, H - 8.5, { align: 'right' });
  }
  return doc;
}
export const docFileName = (d) => `${d.projectNo}-${d.code}-v${d.version}.pdf`;
export const downloadDocPdf = (d, profile) => saveFile(docFileName(d), buildDocPdf(d, profile).output('blob'));
