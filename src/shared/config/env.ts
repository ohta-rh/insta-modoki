import { z } from 'zod';

const envSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(3100),
  APP_ENV: z.enum(['local', 'test', 'production']).default('local'),
});

export type Env = { port: number; appEnv: 'local' | 'test' | 'production' };

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({ PORT: source.PORT, APP_ENV: source.APP_ENV });
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`環境変数の設定が不正です: ${names.join(', ')}`);
  }
  return { port: result.data.PORT, appEnv: result.data.APP_ENV };
}
