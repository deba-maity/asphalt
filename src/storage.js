// Private mode, disabled cookies and full storage must not prevent a race.
const memory = new Map();
const pending = new Map();
export const storage = {
  getItem(key) {
    // A failed write/delete must override an older value still on disk.
    if (pending.has(key)) return pending.get(key);
    try {
      const value = localStorage.getItem(key);
      if (value === null) memory.delete(key); else memory.set(key, value);
      return value;
    } catch { return memory.get(key) ?? null; }
  },
  setItem(key, value) {
    value = String(value); memory.set(key, value);
    try { localStorage.setItem(key, value); pending.delete(key); }
    catch { pending.set(key, value); }
  },
  removeItem(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); pending.delete(key); }
    catch { pending.set(key, null); }
  },
};
