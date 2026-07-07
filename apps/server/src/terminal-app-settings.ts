import type { Pool } from "pg";

import { getSetting, setSetting } from "./db/settings.js";

export const TERMINAL_APP_TYPES = ["ghostty", "terminal"] as const;
export type TerminalAppType = (typeof TERMINAL_APP_TYPES)[number];

const ENABLED_TERMINAL_APPS_KEY = "enabled_terminal_apps";

function isTerminalAppType(value: unknown): value is TerminalAppType {
  return (
    typeof value === "string" &&
    TERMINAL_APP_TYPES.includes(value as TerminalAppType)
  );
}

export function sanitizeEnabledTerminalApps(value: unknown): TerminalAppType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isTerminalAppType)
    .filter((type, index, types) => types.indexOf(type) === index);
}

export async function getEnabledTerminalApps(
  pool: Pool
): Promise<TerminalAppType[]> {
  const raw = await getSetting(pool, ENABLED_TERMINAL_APPS_KEY);
  if (!raw) {
    return [];
  }

  try {
    return sanitizeEnabledTerminalApps(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function setEnabledTerminalApps(
  pool: Pool,
  apps: TerminalAppType[]
): Promise<TerminalAppType[]> {
  const sanitized = sanitizeEnabledTerminalApps(apps);
  await setSetting(pool, ENABLED_TERMINAL_APPS_KEY, JSON.stringify(sanitized));
  return sanitized;
}
