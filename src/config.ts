const withoutTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const apiBase = withoutTrailingSlash(
  import.meta.env.VITE_API_BASE || "https://api.botcgrimoire.top",
);

export const wsBase = withoutTrailingSlash(
  import.meta.env.VITE_WS_BASE || "wss://ws.botcgrimoire.top",
);
