// Common, bounded pagination and quoted search for the private inbox.
export const STATUSES = ['pending', 'reviewing', 'approved', 'rejected'];

export function listQuery(req, columns) {
  const url = new URL(req.url, 'http://localhost');
  const page = Number(url.searchParams.get('page') || 1);
  const pageSize = Number(url.searchParams.get('limit') || 50);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { error: 'Use a positive page number and a limit between 1 and 100.' };
  }
  const query = new URLSearchParams({
    select: '*', limit: String(pageSize), offset: String((page - 1) * pageSize),
    order: 'created_at.desc,id.desc',
  });
  const search = (url.searchParams.get('q') || '').trim().slice(0, 100);
  if (search) {
    const pattern = search.replace(/[\\%_]/g, '\\$&');
    const quoted = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    query.set('or', `(${columns.map(name => `${name}.ilike."%${quoted}%"`).join(',')})`);
  }
  return { query, page, pageSize, status: url.searchParams.get('status') || 'all' };
}

export function pagination(options, total) {
  return { page: options.page, pageSize: options.pageSize, total, hasMore: options.page * options.pageSize < total };
}
