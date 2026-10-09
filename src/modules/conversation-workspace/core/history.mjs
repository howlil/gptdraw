// Combine DOM snapshots without permanently storing chat text. Keep earlier
// pages even when ChatGPT virtualizes and unmounts their DOM while scrolling.
export function mergeVisibleMessages(known, visible, loadingEarlier = false) {
  if (!known.length) return visible.slice();
  if (!visible.length) return known.slice();
  const merged = known.slice();
  const indexOf = id => merged.findIndex(item => item.id === id);
  let newBefore = [], previousId = null;
  const putPending = nextId => {
    if (!newBefore.length) return;
    const index = nextId != null ? indexOf(nextId)
      : previousId != null ? indexOf(previousId)+1
      : loadingEarlier ? 0 : merged.length;
    merged.splice(Math.max(0,index),0,...newBefore);
    newBefore = [];
  };
  for (const item of visible) {
    const index = indexOf(item.id);
    if (index >= 0) {
      putPending(item.id);
      merged[indexOf(item.id)] = item;
      previousId = item.id;
    } else newBefore.push(item);
  }
  putPending(null);
  return merged;
}
