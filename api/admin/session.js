// GET /api/admin/session — does this browser hold a valid admin session?
//
// The admin page calls this on load to decide whether to show the login screen
// or the queue. It is a convenience, not a control: every data endpoint checks
// the cookie itself, so faking a positive answer here gains nothing.

import { json, methodNotAllowed } from '../_lib/http.js';
import { isAuthed } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'GET')) return;
  return json(res, 200, { authed: isAuthed(req) });
}
