import { useEffect, useState } from 'react';
import { ComposerSettings, KeyboardSettings, Language, ThemeId, initialComposerSettings, initialKeyboardSettings, initialLanguage, initialTheme } from '../appModel';

export function useSettings() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [composerSettings, setComposerSettings] = useState<ComposerSettings>(initialComposerSettings);
  const [keyboardSettings, setKeyboardSettings] = useState<KeyboardSettings>(initialKeyboardSettings);

  useEffect(() => {
    window.localStorage.setItem('mindline.language', language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem('mindline.theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('mindline.composerSettings', JSON.stringify(composerSettings));
  }, [composerSettings]);

  useEffect(() => {
    window.localStorage.setItem('mindline.keyboardSettings', JSON.stringify(keyboardSettings));
  }, [keyboardSettings]);

  return {
    language,
    setLanguage,
    theme,
    setTheme,
    composerSettings,
    setComposerSettings,
    keyboardSettings,
    setKeyboardSettings
  };
}
