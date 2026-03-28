(() => {
  const root = (window.noTone ??= {});
  const THEME_KEY = "theme";

  root.getStoredTheme = () => {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };

  root.setStoredTheme = (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // no-op
    }
  };

  root.readTheme = () =>
    root.getStoredTheme() ??
    (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  root.applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
  };

  root.isSafeExternalUrl = (value) => {
    try {
      const raw = String(value || "").trim();
      if (!raw) return false;
      const url = new URL(raw);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  root.openExternal = (url) => {
    if (!root.isSafeExternalUrl(url)) return;
    window.open(String(url), "_blank", "noopener,noreferrer");
  };
})();
