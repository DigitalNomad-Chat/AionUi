import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TTeam } from '@/common/types/team/teamTypes';
import TeamSiderSection from '@/renderer/components/layout/Sider/TeamSiderSection';

const fixtures = vi.hoisted(() => ({
  runningTeamIds: new Set(['running-team']),
  teamBadgeCounts: new Map<string, number>(),
  teams: [] as TTeam[],
  baseTeams: [] as TTeam[],
  refreshTeams: vi.fn(),
  removeTeam: vi.fn().mockResolvedValue(undefined),
  renameTeam: vi.fn().mockResolvedValue(undefined),
  confirmOnOk: undefined as (() => Promise<void>) | undefined,
  navigate: vi.fn(),
  globalMutate: vi.fn(),
}));

fixtures.teams = [
  {
    id: 'running-team',
    user_id: 'user-1',
    name: 'Running team',
    workspace: '/tmp/running',
    workspace_mode: 'shared',
    leader_assistant_id: 'running-lead',
    assistants: [],
    created_at: 1,
    updated_at: 1,
  },
  {
    id: 'idle-team',
    user_id: 'user-1',
    name: 'Idle team',
    workspace: '/tmp/idle',
    workspace_mode: 'shared',
    leader_assistant_id: 'idle-lead',
    assistants: [],
    created_at: 1,
    updated_at: 1,
  },
];
fixtures.baseTeams = fixtures.teams;

vi.mock('@renderer/pages/team/hooks/useTeamList', () => ({
  useTeamList: () => ({
    teams: fixtures.teams,
    mutate: fixtures.refreshTeams,
    removeTeam: fixtures.removeTeam,
  }),
}));

vi.mock('@renderer/pages/team/hooks/useSiderTeamBadges', () => ({
  useSiderTeamBadges: () => fixtures.teamBadgeCounts,
}));

vi.mock('@renderer/components/layout/Sider/useSiderTeamRunning', () => ({
  useSiderTeamRunning: () => (team_id: string) => fixtures.runningTeamIds.has(team_id),
}));

vi.mock('@renderer/components/layout/Sider/SiderItem', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({
      icon,
      name,
      pinned,
      menuItems,
      onMenuAction,
      onClick,
    }: {
      icon: React.ReactNode;
      name: string;
      pinned?: boolean;
      menuItems?: Array<{ key: string }>;
      onMenuAction?: (key: string) => void;
      onClick?: () => void;
    }) =>
      ReactModule.createElement(
        'div',
        {
          'data-testid': `sider-item-${name}`,
          'data-pinned': String(Boolean(pinned)),
          onClick,
        },
        icon,
        menuItems?.map((item) =>
          ReactModule.createElement(
            'button',
            {
              key: item.key,
              'data-testid': `sider-action-${name}-${item.key}`,
              onClick: (event: React.MouseEvent) => {
                event.stopPropagation();
                onMenuAction?.(item.key);
              },
            },
            item.key
          )
        )
      ),
  };
});

vi.mock('@renderer/pages/team/components/TeamCreateModal', () => ({ default: () => null }));
vi.mock('@renderer/pages/team/components/TeamPresetPanel', () => ({ default: () => null }));
vi.mock('@renderer/utils/ui/siderTooltip', () => ({ cleanupSiderTooltips: vi.fn() }));
vi.mock('@renderer/utils/ui/focus', () => ({ blurActiveElement: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => fixtures.navigate }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: fixtures.globalMutate }) }));
vi.mock('@/common', () => ({
  ipcBridge: {
    team: {
      renameTeam: { invoke: fixtures.renameTeam },
    },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const Modal = ({ children, onOk }: { children?: React.ReactNode; onOk?: () => void }) =>
    ReactModule.createElement(
      'div',
      null,
      children,
      onOk ? ReactModule.createElement('button', { 'data-testid': 'rename-confirm', onClick: onOk }) : null
    );
  Modal.confirm = vi.fn((options: { onOk?: () => Promise<void> }) => {
    fixtures.confirmOnOk = options.onOk;
  });

  return {
    Input: () => null,
    Message: { success: vi.fn(), error: vi.fn() },
    Modal,
    Spin: ({ size }: { size?: number }) =>
      ReactModule.createElement('span', { 'data-testid': 'spin', 'data-size': String(size) }),
    Tooltip: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock('@icon-park/react', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return ReactModule.createElement('span', { ...props, 'data-mock-icon': name });
    };

  return {
    Comment: icon('Comment'),
    DeleteOne: icon('DeleteOne'),
    EditOne: icon('EditOne'),
    Peoples: icon('Peoples'),
    Plus: icon('Plus'),
    Pushpin: icon('Pushpin'),
    Right: icon('Right'),
  };
});

const renderSection = (collapsed: boolean) =>
  render(<TeamSiderSection collapsed={collapsed} pathname='/guid' siderTooltipProps={{}} />);

describe('TeamSiderSection running state', () => {
  beforeEach(() => {
    localStorage.clear();
    fixtures.teams = fixtures.baseTeams.map((team) => ({ ...team }));
    fixtures.runningTeamIds.clear();
    fixtures.runningTeamIds.add('running-team');
    fixtures.teamBadgeCounts.clear();
    fixtures.confirmOnOk = undefined;
    localStorage.setItem('team-pinned-ids', JSON.stringify(['running-team', 'idle-team']));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a single create entry in the expanded header (no duplicate preset plus)', () => {
    localStorage.setItem('team-section-expanded', 'true');
    renderSection(false);

    // Reference layout e3f154559 keeps exactly one "+" in the section header; the
    // extra preset "+" regressed in the redo and is covered by the per-team context menu instead.
    expect(screen.getByTestId('team-create-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('team-preset-create-btn')).not.toBeInTheDocument();
  });

  it('shows a spinner for a running team in the expanded section', () => {
    localStorage.setItem('team-section-expanded', 'true');
    renderSection(false);

    const spinnerSlot = screen.getByTestId('team-spinner-running-team');
    expect(within(spinnerSlot).getByTestId('spin')).toHaveAttribute('data-size', '16');
    expect(screen.queryByTestId('team-icon-running-team')).not.toBeInTheDocument();
    expect(screen.getByTestId('sider-item-Running team')).toHaveAttribute('data-pinned', 'false');
  });

  it('keeps the regular team icon for an idle team in the expanded section', () => {
    localStorage.setItem('team-section-expanded', 'true');
    renderSection(false);

    expect(screen.getByTestId('team-icon-idle-team')).toHaveAttribute('data-mock-icon', 'Peoples');
    expect(screen.queryByTestId('team-spinner-idle-team')).not.toBeInTheDocument();
    expect(screen.getByTestId('sider-item-Idle team')).toHaveAttribute('data-pinned', 'true');
  });

  it('keeps an unpinned idle team unpinned', () => {
    localStorage.setItem('team-section-expanded', 'true');
    localStorage.setItem('team-pinned-ids', JSON.stringify(['running-team']));
    renderSection(false);

    expect(screen.getByTestId('sider-item-Idle team')).toHaveAttribute('data-pinned', 'false');
  });

  it('shows a spinner for a running team in collapsed mode', () => {
    fixtures.teamBadgeCounts.set('running-team', 2);
    renderSection(true);

    const spinnerSlot = screen.getByTestId('collapsed-team-spinner-running-team');
    expect(within(spinnerSlot).getByTestId('spin')).toHaveAttribute('data-size', '16');
    expect(screen.queryByTestId('collapsed-team-icon-running-team')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('keeps the regular team icon for an idle team in collapsed mode', () => {
    renderSection(true);

    expect(screen.getByTestId('collapsed-team-icon-idle-team')).toHaveAttribute('data-mock-icon', 'Peoples');
    expect(screen.queryByTestId('collapsed-team-spinner-idle-team')).not.toBeInTheDocument();
  });

  it('renders same-name teams as separate id-addressable rows', () => {
    const duplicateName = 'Ad-hoc Team';
    fixtures.teams.push(
      {
        id: 'adhoc-team-1',
        user_id: 'user-1',
        name: duplicateName,
        workspace: '/tmp/adhoc-1',
        workspace_mode: 'shared',
        leader_assistant_id: 'adhoc-lead-1',
        assistants: [],
        origin_conversation_id: 'conversation-1',
        created_at: 2,
        updated_at: 2,
      },
      {
        id: 'adhoc-team-2',
        user_id: 'user-1',
        name: duplicateName,
        workspace: '/tmp/adhoc-2',
        workspace_mode: 'shared',
        leader_assistant_id: 'adhoc-lead-2',
        assistants: [],
        origin_conversation_id: 'conversation-2',
        created_at: 3,
        updated_at: 3,
      },
      {
        id: 'adhoc-team-3',
        user_id: 'user-1',
        name: duplicateName,
        workspace: '/tmp/adhoc-3',
        workspace_mode: 'shared',
        leader_assistant_id: 'adhoc-lead-3',
        assistants: [],
        origin_conversation_id: 'conversation-3',
        created_at: 4,
        updated_at: 4,
      }
    );
    localStorage.setItem('team-section-expanded', 'true');

    renderSection(false);

    expect(screen.getAllByTestId('sider-item-Ad-hoc Team')).toHaveLength(3);
    expect(screen.getByTestId('team-item-adhoc-team-1')).toHaveAttribute('data-team-id', 'adhoc-team-1');
    expect(screen.getByTestId('team-item-adhoc-team-2')).toHaveAttribute('data-team-id', 'adhoc-team-2');
    expect(screen.getByTestId('team-item-adhoc-team-3')).toHaveAttribute('data-team-id', 'adhoc-team-3');
  });

  it('renames only the selected same-name team by id', async () => {
    fixtures.teams.push(
      { ...fixtures.baseTeams[0], id: 'adhoc-team-1', name: 'Ad-hoc Team', origin_conversation_id: 'conversation-1' },
      { ...fixtures.baseTeams[1], id: 'adhoc-team-2', name: 'Ad-hoc Team', origin_conversation_id: 'conversation-2' }
    );
    localStorage.setItem('team-section-expanded', 'true');
    renderSection(false);

    fireEvent.click(screen.getAllByTestId('sider-action-Ad-hoc Team-rename')[0]);
    fireEvent.click(screen.getByTestId('rename-confirm'));

    await waitFor(() => expect(fixtures.renameTeam).toHaveBeenCalledWith({ id: 'adhoc-team-1', name: 'Ad-hoc Team' }));
    expect(fixtures.renameTeam).not.toHaveBeenCalledWith({ id: 'adhoc-team-2', name: 'Ad-hoc Team' });
  });

  it('deletes only the selected same-name team by id', async () => {
    fixtures.teams.push(
      { ...fixtures.baseTeams[0], id: 'adhoc-team-1', name: 'Ad-hoc Team', origin_conversation_id: 'conversation-1' },
      { ...fixtures.baseTeams[1], id: 'adhoc-team-2', name: 'Ad-hoc Team', origin_conversation_id: 'conversation-2' }
    );
    localStorage.setItem('team-section-expanded', 'true');
    renderSection(false);

    fireEvent.click(screen.getAllByTestId('sider-action-Ad-hoc Team-delete')[1]);
    await fixtures.confirmOnOk?.();

    expect(fixtures.removeTeam).toHaveBeenCalledWith('adhoc-team-2');
    expect(fixtures.removeTeam).not.toHaveBeenCalledWith('adhoc-team-1');
  });

  it('keeps both same-name teams after list refresh', () => {
    fixtures.teams.push(
      { ...fixtures.baseTeams[0], id: 'adhoc-team-1', name: 'Ad-hoc Team', origin_conversation_id: 'conversation-1' },
      { ...fixtures.baseTeams[1], id: 'adhoc-team-2', name: 'Ad-hoc Team', origin_conversation_id: 'conversation-2' }
    );
    localStorage.setItem('team-section-expanded', 'true');
    const rendered = renderSection(false);

    fixtures.teams = fixtures.teams.map((team) => ({ ...team }));
    fixtures.refreshTeams();
    rendered.rerender(<TeamSiderSection collapsed={false} pathname='/guid' siderTooltipProps={{}} />);

    expect(screen.getAllByTestId('sider-item-Ad-hoc Team')).toHaveLength(2);
    expect(screen.getByTestId('team-item-adhoc-team-1')).toBeInTheDocument();
    expect(screen.getByTestId('team-item-adhoc-team-2')).toBeInTheDocument();
  });
});
