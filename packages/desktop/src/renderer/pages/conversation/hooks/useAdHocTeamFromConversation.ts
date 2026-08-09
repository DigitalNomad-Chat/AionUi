import { ipcBridge } from '@/common';
import type { TAdHocTeamAssociation } from '@/common/types/team/adHocTeamTypes';
import useSWR from 'swr';

export const getAdHocTeamRoute = (association: TAdHocTeamAssociation | null | undefined) =>
  association?.team_id ? `/team/${association.team_id}` : null;

/**
 * Reads the ad-hoc team association for the currently open conversation.
 *
 * The source conversation remains a normal history item, so this lookup is
 * intentionally passive: creating or mutating teams belongs to the Team UI.
 */
export const useAdHocTeamFromConversation = (conversationId?: string, userId = 'system_default_user') => {
  const key = conversationId ? ['adHocTeamByConversation', conversationId, userId] : null;
  const { data, error, isLoading, mutate } = useSWR<TAdHocTeamAssociation | null>(key, () =>
    ipcBridge.team.getByConversation.invoke({ conversation_id: conversationId as string, user_id: userId })
  );

  return {
    association: data ?? null,
    team: data?.team,
    error,
    isLoading,
    refresh: mutate,
  };
};
