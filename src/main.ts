import { EditorSuggester } from './EditorSuggester';
import { Editor, MarkdownFileInfo, MarkdownView, Plugin } from 'obsidian';
import SettingTab from './settings/SettingTab';
import { DEFAULT_SETTINGS, ObsidianYouversionLinkerSettings } from './settings/SettingsData';

import GenerateLinks from './GenerateLinks';
import linkPreview from './preview/LinkPreviewReader';
import { linkPreviewPlugin } from './preview/LinkPreviewEditor';
import { migrateSettings } from './settings/SettingsMigrations';

export default class ObsidianYouversionLinker extends Plugin {
  settings: ObsidianYouversionLinkerSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.registerEditorSuggest(new EditorSuggester(this, this.settings));

    if (this.settings.linkPreviewRead) this.registerMarkdownPostProcessor(linkPreview);
    if (this.settings.linkPreviewLive) this.registerEditorExtension([linkPreviewPlugin]);

    this.addSettingTab(new SettingTab(this.app, this));
    this.addCommand({
      id: 'generate-links',
      name: 'Generate links',
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        GenerateLinks(editor, view, this.settings),
    });
  }

  onunload() {}

  async loadSettings() {
    const loaded = (await this.loadData()) as Partial<ObsidianYouversionLinkerSettings>;
    const version = loaded?.version ?? 0;
    this.settings = migrateSettings(loaded, version);
    await this.saveData(this.settings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
