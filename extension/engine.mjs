export async function organize(api, storage, rows, rootId, progress = () => {}) {
  const old = await storage.get('journal');
  if (old.journal?.moves?.some(m => !m.restored)) throw Error('Undo the previous operation first; its undo journal is still active.');
  const tree = await api.getTree();
  const journal = {date: new Date().toISOString(), moves: []};
  await storage.set({backup: tree, journal});
  const folderCache = new Map();
  async function folder(parentId, title) {
    const key = `${parentId}/${title}`;
    if (folderCache.has(key)) return folderCache.get(key);
    const children = await api.getChildren(parentId);
    const found = children.find(n => !n.url && !n.unmodifiable && n.title === title);
    const id = (found || await api.create({parentId, title})).id;
    folderCache.set(key, id);
    return id;
  }
  let moved = 0, skipped = 0;
  for (const row of rows) {
    const [current] = await api.get(row.id);
    if (!current || current.url !== row.url || current.title !== row.title || current.parentId !== row.parentId || current.unmodifiable) {
      skipped++; continue;
    }
    let dest = await folder(rootId, 'Tidymark');
    for (const part of row.category.split(' / ')) dest = await folder(dest, part);
    if (dest === current.parentId) { skipped++; continue; }
    const entry = {id: row.id, parentId: current.parentId, index: current.index, url: current.url, dest, restored: false};
    journal.moves.push(entry);
    // Persist intent before moving: a closed tab or rejected move remains recoverable.
    await storage.set({journal});
    await api.move(row.id, {parentId: dest});
    moved++;
    progress(moved);
  }
  return {moved, skipped};
}
export async function restore(api, storage) {
  const {journal} = await storage.get('journal');
  if (!journal) return {restored: 0, conflicts: 0};
  let restored = 0, conflicts = 0;
  // Reverse order restores original positions even after earlier removals shifted indices.
  for (const move of [...journal.moves].reverse()) {
    if (move.restored) continue;
    try {
      const [node] = await api.get(move.id);
      if (node.url !== move.url || (node.parentId !== move.dest && node.parentId !== move.parentId)) { conflicts++; continue; }
      if (node.parentId === move.dest) {
        const children = await api.getChildren(move.parentId);
        await api.move(move.id, {parentId: move.parentId, index: Math.min(move.index ?? children.length, children.length)});
      }
      move.restored = true;
      await storage.set({journal});
      restored++;
    } catch { conflicts++; }
  }
  return {restored, conflicts};
}
