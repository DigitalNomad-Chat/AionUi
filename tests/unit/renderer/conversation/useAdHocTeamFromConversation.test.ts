import { describe, expect, it } from 'vitest';
import { getAdHocTeamRoute } from '@/renderer/pages/conversation/hooks/useAdHocTeamFromConversation';

describe('getAdHocTeamRoute', () => {
  it('returns the Team route for an active source association', () => {
    expect(getAdHocTeamRoute({ team_id: 'team-1', origin_conversation_id: 'conversation-1', status: 'active' })).toBe(
      '/team/team-1'
    );
  });

  it('does not expose a route when no association exists', () => {
    expect(getAdHocTeamRoute(null)).toBeNull();
    expect(
      getAdHocTeamRoute({ team_id: '', origin_conversation_id: 'conversation-1', status: 'disbanded' })
    ).toBeNull();
  });
});
