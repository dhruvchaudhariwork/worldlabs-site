// Supabase access over its PostgREST API, using built-in fetch.
//
// No SDK on purpose: it keeps this repo dependency-free and build-step-free,
// which is how the rest of the site works.
//
// The service_role key bypasses RLS entirely. It is read from the environment
// and must only ever be used here, server-side. If it reaches the browser,
// every table is readable and writable by anyone.

const url = () => {
  const v = process.env.SUPABASE_URL;
  if (!v) throw new Error('SUPABASE_URL is not set');
  return v.replace(/\/$/, '');
};

const key = () => {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return v;
};

/** Raw PostgREST request. `path` is e.g. `applications?select=*&status=eq.pending`. */
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const k = key();
  const headers = {
    apikey: k,
    Authorization: `Bearer ${k}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${url()}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = new Error(
      `Supabase ${method} ${path} → ${res.status}: ${
        data?.message || data?.hint || text || res.statusText
      }`
    );
    err.status = res.status;
    err.supabase = data;
    throw err;
  }

  return data;
}

export const db = {
  rest,

  /** Insert rows. Returns the inserted rows. */
  async insert(table, rows) {
    return rest(table, {
      method: 'POST',
      body: rows,
      prefer: 'return=representation',
    });
  },

  /**
   * Insert, or update the existing row on unique-constraint conflict.
   * `onConflict` is the conflicting column, e.g. 'email'.
   */
  async upsert(table, rows, onConflict) {
    return rest(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: 'POST',
      body: rows,
      prefer: 'return=representation,resolution=merge-duplicates',
    });
  },

  /** Select with a raw PostgREST query string, e.g. `select=*&status=eq.pending`. */
  async select(table, query = 'select=*') {
    return rest(`${table}?${query}`);
  },

  /** Patch rows matched by `query`. Returns the updated rows. */
  async update(table, query, patch) {
    return rest(`${table}?${query}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=representation',
    });
  },
};

export default db;
