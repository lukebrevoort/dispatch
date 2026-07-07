export const TERMINAL_APP_TYPES = ["ghostty", "terminal"] as const;
export type TerminalAppType = (typeof TERMINAL_APP_TYPES)[number];

export const TERMINAL_APP_LABELS: Record<TerminalAppType, string> = {
  ghostty: "Ghostty",
  terminal: "Terminal",
};

export function isTerminalAppType(value: unknown): value is TerminalAppType {
  return (
    typeof value === "string" &&
    TERMINAL_APP_TYPES.includes(value as TerminalAppType)
  );
}

export function sanitizeEnabledTerminalApps(value: unknown): TerminalAppType[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isTerminalAppType)
    .filter((type, index, types) => types.indexOf(type) === index);
}
