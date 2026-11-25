/**
 * Sheets that lie over the page right now. A ghost under one of them keeps still until the sheet leaves:
 * drawn on behind the sheet's blur, it cost as much as the ghost on the sheet, and with both of them moving
 * a small phone made half the pictures it should.
 */
type Listener = () => void;
/** In the order they opened: a later one lies above an earlier one. */
const sheets: Element[] = [];
const subs = new Set<Listener>();
const tell = () => {
  for (const fn of subs) fn();
};

/** A sheet is up. Returns what takes it away again. */
export function cover(sheet: Element): () => void {
  sheets.push(sheet);
  tell();
  return () => {
    const i = sheets.indexOf(sheet);
    if (i < 0) return;
    sheets.splice(i, 1);
    tell();
  };
}

/** Does a sheet lie over this element? One that holds the element does not cover it, but every sheet opened after that one does. */
export function covered(el: Element): boolean {
  let own = -1;
  sheets.forEach((s, i) => {
    if (s.contains(el)) own = i;
  });
  return sheets.length > own + 1;
}

export function onCover(fn: Listener): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
