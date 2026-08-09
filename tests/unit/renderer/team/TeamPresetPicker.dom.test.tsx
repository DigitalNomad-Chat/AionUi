import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamPresetPicker from '@/renderer/pages/team/components/TeamPresetPicker';
import type { TeamPreset } from '@/common/types/team/teamTypes';

const preset = {
  id: 'p1',
  user_id: 'u1',
  name: 'Research',
  description: 'Research',
  expertise_tags: [],
  example_prompts: [],
  leader: { assistant_backend: 'aionrs', assistant_name: 'Lead', role: 'leader', order: 0 },
  members: [],
  version: 1,
  created_at: '',
  updated_at: '',
} satisfies TeamPreset;

describe('TeamPresetPicker', () => {
  it('supports selecting and invoking a preset card', () => {
    const onSelect = vi.fn();
    const onInvoke = vi.fn();
    render(<TeamPresetPicker presets={[preset]} onSelect={onSelect} onInvoke={onInvoke} />);
    fireEvent.click(screen.getByTestId('preset-picker-item-p1').querySelector('button')!);
    expect(onSelect).toHaveBeenCalledWith(preset);
    fireEvent.click(screen.getByTestId('preset-picker-invoke-p1'));
    expect(onInvoke).toHaveBeenCalledWith(preset);
  });

  it('keeps a create action visible when there are no presets', () => {
    const onCreate = vi.fn();
    render(<TeamPresetPicker presets={[]} onCreate={onCreate} onSelect={vi.fn()} onInvoke={vi.fn()} />);
    fireEvent.click(screen.getByTestId('preset-picker-new'));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
