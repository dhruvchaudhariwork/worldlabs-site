// Supabase access over its PostgREST API, using built-in fetch.
//
// No runtime SDK or build step. The local migration tool has its own dependency.
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
  const v = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error('SUPABASE_SECRET_KEY is not set');
  return v;
};

/** Raw PostgREST request. `path` is e.g. `applications?select=*&status=eq.pending`. */
async function rest(path, { method = 'GET', body, prefer, withCount = false } = {}) {
  const k = key();
  const headers = {
    apikey: k,
    'Content-Type': 'application/json',
  };
  // Modern secret keys authenticate through apikey, not a JWT bearer header.
  if (!k.startsWith('sb_secret_')) headers.Authorization = `Bearer ${k}`;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${url()}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
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

  const total = res.headers.get('content-range')?.split('/').at(-1);
  // Reviewing the last item on a page can move it out of the current filter.
  // PostgREST returns 416 plus the new total when that offset no longer exists.
  if (withCount && method === 'GET' && res.status === 416 && data?.code === 'PGRST103' && /^\d+$/.test(total || '')) {
    return { rows: [], total: Number(total) };
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

  if (withCount) {
    if (!total || !/^\d+$/.test(total)) throw new Error('Database did not return an exact count');
    return { rows: data || [], total: Number(total) };
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

  async page(table, query) {
    return rest(`${table}?${query}`, { prefer: 'count=exact', withCount: true });
  },

  async count(table, query = '') {
    const result = await rest(`${table}?select=id&limit=0${query ? `&${query}` : ''}`, {
      method: 'HEAD', prefer: 'count=exact', withCount: true,
    });
    return result.total;
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
