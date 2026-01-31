export const themes = {
  dark: {
    name: 'dark',
    bgPrimary: '#010205',
    bgSecondary: '#050811',
    bgTertiary: 'rgba(10, 12, 20, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    textPrimary: '#e8e8e8',
    textSecondary: 'rgba(255, 255, 255, 0.5)',
    accentCyan: '#00c5d4',
    accentMagenta: '#d946ef',
    accentPurple: '#9b7ed6',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    glowCyan: 'rgba(0, 197, 212, 0.3)',
    glowMagenta: 'rgba(217, 70, 239, 0.4)',
  }
};

export const applyTheme = (theme) => {
  const root = document.documentElement;
  const currentTheme = themes[theme];
  
  root.style.setProperty('--bg-primary', currentTheme.bgPrimary);
  root.style.setProperty('--bg-secondary', currentTheme.bgSecondary);
  root.style.setProperty('--bg-tertiary', currentTheme.bgTertiary);
  root.style.setProperty('--border-color', currentTheme.borderColor);
  root.style.setProperty('--text-primary', currentTheme.textPrimary);
  root.style.setProperty('--text-secondary', currentTheme.textSecondary);
  root.style.setProperty('--accent-cyan', currentTheme.accentCyan);
  root.style.setProperty('--accent-magenta', currentTheme.accentMagenta);
  root.style.setProperty('--accent-purple', currentTheme.accentPurple);
  root.style.setProperty('--shadow', currentTheme.shadow);
  root.style.setProperty('--glow-cyan', currentTheme.glowCyan);
  root.style.setProperty('--glow-magenta', currentTheme.glowMagenta);
};
