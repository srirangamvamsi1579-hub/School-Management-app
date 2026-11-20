// Save a file the app made (proposal PDF, backup, Excel). Inside the Claude artifact viewer the page can't
// download directly, so it asks the viewer through the `downloads` capability (they confirm the save);
// everywhere else (the hosted site, the phone app) it is an ordinary browser download.
export async function saveFile(filename, data) {
  const w = typeof window !== 'undefined' ? window : null;
  if (w && typeof w.claude?.use === 'function') {
    const downloads = await w.claude.use('downloads');
    if (downloads) {
      try { await downloads.save({ filename, data }); return 'saved'; } catch (e) {
        if (e?.code === 'declined') return 'declined';
        if (!['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e?.code)) throw new Error(e?.message || 'The file could not be saved');
      }
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}
// XLSX workbook → saved file
export const saveWorkbook = (XLSX, wb, filename) => saveFile(filename, new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
