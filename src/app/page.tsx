import { connection } from 'next/server';

// Placeholder page; #24 replaces it with the app shell.
export default async function HomePage() {
  // Opt out of static rendering: the CSP nonce from src/proxy.ts is per request (ADR-0026).
  await connection();
  return (
    <main>
      <h1>Mado（仮称）</h1>
    </main>
  );
}
