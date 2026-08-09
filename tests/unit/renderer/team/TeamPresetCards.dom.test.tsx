import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamPresetCards from '@/renderer/pages/team/components/TeamPresetCards';
import type { TeamPreset } from '@/common/types/team/teamTypes';

const preset = {
  id: 'preset-1',
  user_id: 'user-1',
  name: 'Research experts',
  description: 'Research team',
  expertise_tags: [],
  example_prompts: [],
  leader: { assistant_backend: 'aionrs', assistant_name: 'Lead', role: 'leader', order: 0 },
  members: [],
  version: 1,
  created_at: '',
  updated_at: '',
} satisfies TeamPreset;

describe('TeamPresetCards', () => {
  it('renders cards and opens the selected preset', () => {
    const onSelect = vi.fn();
    render(<TeamPresetCards presets={[preset]} onCreate={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('team-preset-card-preset-1'));
    expect(onSelect).toHaveBeenCalledWith(preset);
    expect(screen.getByTestId('team-preset-cards-create')).toBeInTheDocument();
  });

  it('renders the create action for an empty preset list', () => {
    const onCreate = vi.fn();
    render(<TeamPresetCards presets={[]} onCreate={onCreate} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByTestId('team-preset-cards-create'));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
