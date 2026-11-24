import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { harness } from './harness';

// harness() blocks the test process (execFileSync), so the stand-in server runs in its own process.
const SERVER = `
const http = require('node:http');
const body = process.argv[1];
const s = http.createServer((q, r) => { r.writeHead(500, { 'content-type': 'application/json' }); r.end(body); });
// No host: binds :: (dual-stack) so both http://localhost resolving to ::1 and to 127.0.0.1 reach it;
// where IPv6 is unavailable, fall back to localhost itself.
s.on('error', () => s.listen(0, 'localhost'));
s.listen(0, () => console.log(s.address().port));
`;

describe('harness()', () => {
  let child: ChildProcess | undefined;
  afterEach(() => {
    child?.kill();
    delete process.env.PORT;
  });

  it('a 500 body reaches the thrown message', async () => {
    const body = JSON.stringify({
      error: 'operation failed',
      op: 'seedUser',
      name: 'TypeError',
      message: 'boom',
    });
    child = spawn(process.execPath, ['-e', SERVER, body], { stdio: ['ignore', 'pipe', 'inherit'] });
    const port = await new Promise<string>((ok) =>
      child!.stdout!.once('data', (d: Buffer) => ok(d.toString().trim())),
    );
    process.env.PORT = port;
    expect(() => harness({ op: 'seedUser' })).toThrow(
      `E2E ハーネスの seedUser が失敗しました: 500 ${body}`,
    );
  });
});
