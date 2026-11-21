import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseArgs, resolveDemoPassword, runSeed, type SeedEnv } from './seed';

const untouchable = new Proxy(
  {},
  {
    get() {
      throw new Error('DB に触った');
    },
  },
);
const env = { DB: untouchable, AUTH_PEPPER: 'pepper' } as unknown as SeedEnv;

describe('runSeed', () => {
  it('APP_ENV が production のとき、DB に触らずに 1 を返す', async () => {
    const log = vi.fn();
    const code = await runSeed(['--profile', 'demo'], {
      env,
      vars: { APP_ENV: 'production' },
      log,
    });
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith('本番の DB にはシードを入れません');
  });

  it('引数が正しくないとき、DB に触らずに 2 を返す', async () => {
    const log = vi.fn();
    expect(await runSeed([], { env, vars: {}, log })).toBe(2);
    expect(await runSeed(['--profile', 'huge'], { env, vars: {}, log })).toBe(2);
    expect(await runSeed(['--profile'], { env, vars: {}, log })).toBe(2);
  });

  it('バケットがスロットのものでないとき、DB に触らずに 1 を返す', async () => {
    const log = vi.fn();
    const other = { ...env, S3_BUCKET: 'insta-prod' } as unknown as SeedEnv;
    expect(await runSeed(['--profile', 'demo'], { env: other, vars: {}, log })).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('insta-prod'));
  });
});

describe('parseArgs', () => {
  it('--profile demo と bench だけを受け付ける', () => {
    expect(parseArgs(['--profile', 'demo'])).toBe('demo');
    expect(parseArgs(['--profile', 'bench'])).toBe('bench');
    expect(parseArgs(['--profile', 'x'])).toBeNull();
    expect(parseArgs(['demo'])).toBeNull();
  });
});

describe('resolveDemoPassword', () => {
  it('パスワードが未設定のとき 16 字を作って 1 度だけ出す', () => {
    const log = vi.fn();
    const password = resolveDemoPassword({}, log);
    expect(password).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toContain(password);
    expect(resolveDemoPassword({}, vi.fn())).not.toBe(password);
  });

  it('SEED_DEMO_PASSWORD があるときはそれを使い 何も出さない', () => {
    const log = vi.fn();
    expect(resolveDemoPassword({ SEED_DEMO_PASSWORD: 'given-value-1234' }, log)).toBe(
      'given-value-1234',
    );
    expect(log).not.toHaveBeenCalled();
  });
});

describe('シードのコード', () => {
  const root = join(import.meta.dirname, '../../../..');
  const pattern = new RegExp(['fetch\\(', 'https?:' + '//'].join('|'));
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return path.endsWith('.ts') && !path.endsWith('seed.test.ts') ? [path] : [];
    });

  it('外部の URL とダウンロードを含まない', () => {
    const hits = [join(root, 'scripts/seed'), join(root, 'src/shared/db/seed')]
      .flatMap(files)
      .filter((f) => pattern.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
