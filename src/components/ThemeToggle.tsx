import React from 'react';
import { useThemeStore } from '../store/theme';
import { Sun, Moon, Laptop } from '@/icons';
import { RadioGroup } from './ui/controls';

export const ThemeToggle: React.FC = () => {
  const { preference, setPreference } = useThemeStore();
  return (
    <RadioGroup
      label="Color theme"
      value={preference}
      onValueChange={setPreference}
      segmented
      options={[
        { value: 'light', label: 'Light theme', icon: <Sun size={19} aria-hidden="true" /> },
        { value: 'dark', label: 'Dark theme', icon: <Moon size={19} aria-hidden="true" /> },
        {
          value: 'system',
          label: 'Automatic theme',
          icon: <Laptop size={19} aria-hidden="true" />,
        },
      ]}
    />
  );
};
