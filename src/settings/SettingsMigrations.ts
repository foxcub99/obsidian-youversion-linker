import { DEFAULT_SETTINGS, type ObsidianYouversionLinkerSettings } from './SettingsData';

export function migrateSettings(
  settings: Partial<ObsidianYouversionLinkerSettings>,
  version: number,
): ObsidianYouversionLinkerSettings {
  if (version < 1) settings = migrateToVersion1(settings);

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
}

function migrateToVersion1(
  settings: Partial<ObsidianYouversionLinkerSettings>,
): Partial<ObsidianYouversionLinkerSettings> {
  settings.version = 1;

  return settings;
}
