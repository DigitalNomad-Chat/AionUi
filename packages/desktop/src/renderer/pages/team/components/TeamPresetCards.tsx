import { Button } from '@arco-design/web-react';
import { Plus, Right } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamPreset } from '@/common/types/team/teamTypes';

type Props = {
  presets: TeamPreset[];
  onCreate: () => void;
  onSelect: (preset: TeamPreset) => void;
};

/** Compact expert-team cards for the Team header. Applying a preset remains in the existing Team flow. */
const TeamPresetCards: React.FC<Props> = ({ presets, onCreate, onSelect }) => {
  const { t } = useTranslation();

  return (
    <div data-testid='team-preset-cards' className='flex items-center gap-6px max-w-420px overflow-x-auto'>
      {presets.length === 0 ? (
        <div className='flex items-center gap-6px text-12px text-t-tertiary whitespace-nowrap'>
          <span>{t('settings.no_presets', { defaultValue: 'No presets' })}</span>
          <Button
            type='text'
            size='mini'
            icon={<Plus theme='outline' size='14' />}
            data-testid='team-preset-cards-create'
            onClick={onCreate}
          >
            {t('team.presets.createPreset', { defaultValue: 'Create expert team' })}
          </Button>
        </div>
      ) : (
        <>
          {presets.map((preset) => (
            <Button
              key={preset.id}
              type='text'
              size='mini'
              className='shrink-0 !border !border-border-2 !rounded-8px px-8px py-4px'
              data-testid={`team-preset-card-${preset.id}`}
              onClick={() => onSelect(preset)}
            >
              <span className='max-w-100px truncate'>{preset.name}</span>
              <Right theme='outline' size='12' />
            </Button>
          ))}
          <Button
            type='text'
            size='mini'
            icon={<Plus theme='outline' size='14' />}
            data-testid='team-preset-cards-create'
            onClick={onCreate}
          >
            {t('team.presets.newPreset', { defaultValue: 'New' })}
          </Button>
        </>
      )}
    </div>
  );
};

export default TeamPresetCards;
