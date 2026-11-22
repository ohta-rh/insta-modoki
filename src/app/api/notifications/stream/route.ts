import { streamNotifications } from '../../../../features/notification/ui';

// The unread count as server-sent events (ADR-0050). Never cached or prerendered.
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return streamNotifications(request);
}
