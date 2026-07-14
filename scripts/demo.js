// Runs the whole site locally against an in-memory database, so the full
// apply → review → approve flow can be clicked through without touching
// Supabase or the internet.
//
//   npm run demo
//
// The store is in-memory: everything vanishes when you stop the process. This
// is a development harness, not a preview of production data.

import { createFakeSupabase } from '../tests/fake-supabase.js';

const fake = createFakeSupabase();
const url = await fake.listen();

process.env.SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'demo-key';
process.env.ADMIN_PASSWORD ||= 'demo';
process.env.SESSION_SECRET ||= 'demo-session-secret-not-for-production';
process.env.WL_DEMO = '1';

console.log('\n  ┌─────────────────────────────────────────────────────┐');
console.log('  │  DEMO MODE — in-memory database, nothing persists.  │');
console.log('  │  Admin password: ' + process.env.ADMIN_PASSWORD.padEnd(35) + '│');
console.log('  └─────────────────────────────────────────────────────┘');

await import('./dev-server.js');
