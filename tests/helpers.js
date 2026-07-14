// Minimal req/res doubles so handlers can be invoked in-process, the same way
// Vercel invokes them.

import { EventEmitter } from 'node:events';

export function mockReq({ method = 'GET', url = '/', body, headers = {}, cookie } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { 'user-agent': 'test-agent', ...headers };
  if (cookie) req.headers.cookie = cookie;
  req.body = body;
  req.socket = { remoteAddress: '10.0.0.1' };
  // Handlers may `for await (const c of req)`; with req.body set they don't,
  // but an empty async iterator keeps that path safe.
  req[Symbol.asyncIterator] = async function* () {};
  return req;
}

export function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    headersSent: false,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    getHeader(k) {
      return this.headers[k.toLowerCase()];
    },
    end(payload) {
      this.ended = true;
      this.headersSent = true;
      this.body = payload;
      try {
        this.json = JSON.parse(payload);
      } catch {
        this.json = null;
      }
    },
  };
  return res;
}

/** Pull the session cookie value out of a Set-Cookie header. */
export function cookieFrom(res) {
  const sc = res.getHeader('set-cookie');
  if (!sc) return null;
  return String(sc).split(';')[0];
}
