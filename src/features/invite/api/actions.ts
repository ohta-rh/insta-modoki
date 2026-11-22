'use server';

import { run, type ActionResult } from '../../../shared/action';
import { createInvite } from './create-invite';
import { listInvites, type InvitePage } from './list-invites';
import { revokeInvite } from './revoke-invite';
import type { InviteView } from '../model/view';

/** The admin screen's Server Actions: each returns the result or the error body, never throws. */
export async function createInviteAction(input: unknown): Promise<ActionResult<InviteView>> {
  return run('createInvite', (headers) => createInvite(input, { headers }));
}

export async function listInvitesAction(input: unknown): Promise<ActionResult<InvitePage>> {
  return run('listInvites', (headers) => listInvites(input, { headers }));
}

export async function revokeInviteAction(input: unknown): Promise<ActionResult<{ revoked: true }>> {
  return run('revokeInvite', (headers) => revokeInvite(input, { headers }));
}
