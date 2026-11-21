import { describe, expect, it } from 'vitest';
import type { StorageClient } from './client';
import { removeObjects } from './remove';

const clientWith = (respond: (body: string, n: number) => Response) => {
  const bodies: string[] = [];
  const client = {
    bucketUrl: 'http://s3.test/bucket',
    aws: {
      fetch: async (_url: string, init: RequestInit) => {
        bodies.push(String(init.body));
        return respond(String(init.body), bodies.length);
      },
    },
  } as unknown as StorageClient;
  return { client, bodies };
};

const ok = (inner = '') => new Response(`<DeleteResult>${inner}</DeleteResult>`, { status: 200 });

describe('removeObjects', () => {
  it('キーが空のとき 要求を送らない', async () => {
    const { client, bodies } = clientWith(() => ok());
    expect(await removeObjects(client, [])).toEqual([]);
    expect(bodies).toHaveLength(0);
  });

  it('個々の Error があるとき 失敗したキーだけを返し 無いキーは成功とみなす', async () => {
    const { client } = clientWith(() =>
      ok(
        '<Error><Key>a &amp; b.webp</Key><Code>InternalError</Code></Error>' +
          '<Error><Key>gone.webp</Key><Code>NoSuchKey</Code></Error>',
      ),
    );
    expect(await removeObjects(client, ['a & b.webp', 'gone.webp', 'c.webp'])).toEqual([
      'a & b.webp',
    ]);
  });

  it('要求そのものが失敗したとき その要求の全部のキーを返す', async () => {
    const { client } = clientWith(() => new Response('x', { status: 500 }));
    expect(await removeObjects(client, ['a', 'b'])).toEqual(['a', 'b']);
    const thrown = {
      bucketUrl: 'http://s3.test/b',
      aws: {
        fetch: async () => {
          throw new Error('network');
        },
      },
    } as unknown as StorageClient;
    expect(await removeObjects(thrown, ['a'])).toEqual(['a']);
  });

  it('1,000 個ごとに要求を分け キーを XML に書くとき特殊文字を逃がす', async () => {
    const { client, bodies } = clientWith(() => ok());
    const keys = Array.from({ length: 1001 }, (_, i) => `k${i}<"&>`);
    expect(await removeObjects(client, keys)).toEqual([]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain('<Key>k0&lt;&quot;&amp;&gt;</Key>');
    expect(bodies[1]!.match(/<Key>/g)).toHaveLength(1);
  });
});
