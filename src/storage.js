// window.storage shim — async API backed by localStorage.
// get() throws on missing key (matches the spec's contract; callers wrap in
// try/catch or .catch(() => null)).

const NS = "dgm:";

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), 0));
}

const storage = {
  async get(key) {
    const raw = localStorage.getItem(NS + key);
    if (raw === null) {
      throw new Error(`storage: missing key "${key}"`);
    }
    return delay(JSON.parse(raw));
  },

  async set(key, value) {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return delay(true);
  },

  async remove(key) {
    localStorage.removeItem(NS + key);
    return delay(true);
  },

  async list(prefix = "") {
    const out = [];
    const fullPrefix = NS + prefix;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) {
        out.push(k.slice(NS.length));
      }
    }
    return delay(out);
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
