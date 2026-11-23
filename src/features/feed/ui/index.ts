// The feed slice's entry for its components, client and server (ADR-0057). `../index.ts` publishes
// only processing and types, so importing a process never loads a component.
export { Feed } from './Feed';
export { renderFeedCards } from './feed-cards';
