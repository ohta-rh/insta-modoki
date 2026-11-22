import type { StorageEnv } from '../shared/storage/client.ts';
import type { removeObjects } from '../shared/storage/remove.ts';

// Jobs run in the Worker (Cron Trigger) and in Node (`pnpm jobs:run`), so they use the D1 binding
// directly and import only with `.ts` extensions (ADR-0049, like src/shared/db/seed/seed.ts).

export type JobStatement = {
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

export type JobD1 = {
  prepare(sql: string): { bind(...values: unknown[]): JobStatement };
  batch(statements: JobStatement[]): Promise<unknown[]>;
};

export type JobEnv = { DB: JobD1 } & StorageEnv;

export type JobContext = {
  env: JobEnv;
  /** The only clock a job reads. */
  now: Date;
  /** Tests replace the storage delete. */
  removeObjects?: typeof removeObjects;
};

export type Job = (ctx: JobContext) => Promise<{ deleted: number }>;
