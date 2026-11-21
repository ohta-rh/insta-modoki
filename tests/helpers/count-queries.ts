type Stmt = Record<string | symbol, unknown>;
type D1Like = { prepare(sql: string): Stmt; batch(statements: unknown[]): Promise<unknown[]> };

/**
 * Wraps a D1 binding and counts the round trips the code under test makes: every statement run on
 * its own (`all` / `run` / `raw` / `first`) is one, and a `batch` is one however many statements
 * it holds (the way a Worker pays for D1).
 */
export function countQueries<T extends D1Like>(d1: T): { d1: T; count: () => number } {
  let n = 0;
  /** The real statement behind each wrapper: a batch must be handed the real ones. */
  const real = new WeakMap<object, Stmt>();
  const wrapStatement = (stmt: Stmt): Stmt => {
    const proxy: Stmt = new Proxy(stmt, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          if (prop === 'all' || prop === 'run' || prop === 'raw' || prop === 'first') n += 1;
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          // bind() returns a new statement: keep counting on it.
          return prop === 'bind' ? wrapStatement(result as Stmt) : result;
        };
      },
    });
    real.set(proxy, stmt);
    return proxy;
  };
  const wrapped = new Proxy(d1, {
    get(target, prop) {
      const value = (target as unknown as Stmt)[prop];
      if (prop === 'prepare') {
        return (sql: string) => wrapStatement(target.prepare(sql));
      }
      if (prop === 'batch') {
        return (statements: unknown[]) => {
          n += 1;
          return target.batch(statements.map((s) => real.get(s as object) ?? s));
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { d1: wrapped, count: () => n };
}
