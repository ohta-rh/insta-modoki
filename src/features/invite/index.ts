// The invite slice's public entry for other slices: what sign-up needs to check and take an invite
// (ADR-0014, ADR-0053). It must stay free of components and of the admin processes (which import
// `auth`): `auth` imports this file. The routes import the screen from './ui'.
export { assertInviteUsable, findInvite, inviteBatchStatement, inviteFailure } from './api/consume';
export { INVITE_MESSAGES } from './model/messages';
export { getInviteStatus, type InviteStatus } from './model/status';
