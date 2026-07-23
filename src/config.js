const withoutTrailingSlash = (value) => value.replace(/\/$/, "");

export const apiBase = withoutTrailingSlash(
  process.env.VUE_APP_API_BASE || "https://api.botcgrimoire.top",
);

export const wsBase = withoutTrailingSlash(
  process.env.VUE_APP_WS_BASE || "wss://ws.botcgrimoire.top",
);
