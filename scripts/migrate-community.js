// Applies only the application/waitlist schema; never resets existing data.
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { loadEnvironment } from './load-env.js';

loadEnvironment();
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connection) throw new Error('Set POSTGRES_URL in the selected environment file before migrating.');
const sql = postgres(connection, {
  max:1, prepare:false, connect_timeout:15,
  ssl:{ rejectUnauthorized:true, ...(process.env.POSTGRES_CA_CERT ? { ca:process.env.POSTGRES_CA_CERT } : {}) },
  onnotice:() => {},
});
try {
  const schema = await readFile(new URL('../sql/community.sql', import.meta.url), 'utf8');
  await sql.unsafe(schema).simple();
  const tables = await sql`
    select relname, relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT') as anonymous_read,
      has_table_privilege('authenticated', c.oid, 'SELECT') as member_read,
      (has_table_privilege('service_role', c.oid, 'SELECT')
       and has_table_privilege('service_role', c.oid, 'INSERT')
       and has_table_privilege('service_role', c.oid, 'UPDATE')) as server_access
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('applications', 'waitlist')`;
  if (tables.length !== 2 || tables.some(table => !table.relrowsecurity || table.anonymous_read || table.member_read || !table.server_access)) {
    throw new Error('Submission table access checks failed');
  }
  console.log('Community schema applied. Both submission tables are private and available to the server.');
} catch (error) {
  // Connection errors can include credentials; print only a diagnostic code.
  console.error('Migration failed:', error.code || error.name);
  process.exitCode = 1;
} finally { await sql.end({ timeout:5 }); }
