import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamPresetEditorModal from '@/renderer/pages/team/components/TeamPresetEditorModal';

const { assistants } = vi.hoisted(() => ({
  assistants: [{ id: 'a1', name: 'Lead', backend: 'aionrs', team_selectable: true }],
}));
vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return { ...actual, Message: { warning: vi.fn(), error: vi.fn() } };
});
vi.mock('@/renderer/pages/team/hooks/useTeamAssistantOptions', () => ({
  useTeamAssistantOptions: () => ({ assistants }),
}));

vi.mock('@renderer/components/base/AionModal', () => ({
  default: ({
    children,
    footer,
    header,
  }: {
    children: React.ReactNode;
    footer?: { render: () => React.ReactNode };
    header?: { title?: React.ReactNode };
  }) => (
    <div role='dialog'>
      <h2>{header?.title}</h2>
      {children}
      {footer?.render()}
    </div>
  ),
}));

describe('TeamPresetEditorModal', () => {
  it('renders the complete editor and blocks an empty save', () => {
    const onSaved = vi.fn();
    render(<TeamPresetEditorModal visible onCancel={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByTestId('preset-editor-name')).toBeInTheDocument();
    expect(screen.getByTestId('preset-editor-tag-input')).toBeInTheDocument();
    expect(screen.getByTestId('preset-editor-example-input')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preset-editor-save'));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('supports tags, examples, member selection and save payload', () => {
    const onSaved = vi.fn();
    render(<TeamPresetEditorModal visible onCancel={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('preset-editor-name'), { target: { value: 'Research' } });
    fireEvent.change(screen.getByTestId('preset-editor-tag-input'), { target: { value: 'analysis' } });
    fireEvent.click(screen.getAllByText('Add')[0]);
    fireEvent.change(screen.getByTestId('preset-editor-example-input'), { target: { value: 'Summarize papers' } });
    fireEvent.click(screen.getAllByText('Add')[1]);
    fireEvent.click(screen.getByTestId('preset-editor-agent-option-a1'));
    fireEvent.click(screen.getByTestId('preset-editor-save'));
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Research',
        expertise_tags: ['analysis'],
        example_prompts: ['Summarize papers'],
      }),
      undefined
    );
  });
});
