import { runCommand } from "../shared/lib/run-command.js";
import type { TerminalAppType } from "../terminal-app-settings.js";

// Flashed via tmux display-message on attach: Ctrl-C in the external window
// stops the agent itself (it is Dispatch's own stop mechanism), while closing
// the window merely detaches.
const ATTACH_HINT = "Detach: close window or C-b d — Ctrl-C stops the agent";

// Shell line run inside the new terminal window. The escaped `\;` reaches
// tmux as a `;` argument, sequencing the attach with the hint flash.
function tmuxAttachShellLine(sessionName: string): string {
  return `tmux attach-session -t '${sessionName}' \\; display-message '${ATTACH_HINT}'`;
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function assertSafeSessionName(sessionName: string): void {
  // Session names are generated as [A-Za-z0-9_-] but the prefix is
  // env-configurable; refuse anything that could escape the quoting below.
  if (!/^[A-Za-z0-9_-]+$/.test(sessionName)) {
    throw new Error(`Unsafe tmux session name: ${sessionName}`);
  }
}

export type LaunchInvocation = {
  command: string;
  args: string[];
};

export function buildLaunchInvocation(
  app: TerminalAppType,
  sessionName: string
): LaunchInvocation {
  assertSafeSessionName(sessionName);
  const shellLine = tmuxAttachShellLine(sessionName);
  switch (app) {
    case "ghostty":
      // Ghostty ≥1.3 is AppleScript-scriptable: `new window` opens in the
      // already-running instance (no second app instance / dock icon) and
      // launches Ghostty if it isn't running.
      return {
        command: "osascript",
        args: [
          "-e",
          'tell application "Ghostty"',
          "-e",
          "activate",
          "-e",
          `new window with configuration {command:"${escapeAppleScriptString(shellLine)}"}`,
          "-e",
          "end tell",
        ],
      };
    case "terminal":
      // Terminal.app can't take a command via `open`, so drive it with
      // AppleScript; `do script` runs a shell line in a new window.
      return {
        command: "osascript",
        args: [
          "-e",
          `tell application "Terminal" to do script "${escapeAppleScriptString(shellLine)}"`,
          "-e",
          'tell application "Terminal" to activate',
        ],
      };
  }
}

// Pre-1.3 Ghostty has no AppleScript support; `open -n` starts a separate
// instance whose window runs the attach. Args after --args go to Ghostty
// verbatim (no shell), so the tmux `;` separator is its own argument.
export function buildGhosttyFallbackInvocation(
  sessionName: string
): LaunchInvocation {
  assertSafeSessionName(sessionName);
  return {
    command: "open",
    args: [
      "-na",
      "Ghostty",
      "--args",
      "-e",
      "tmux",
      "attach-session",
      "-t",
      sessionName,
      ";",
      "display-message",
      ATTACH_HINT,
    ],
  };
}

export async function launchExternalTerminal(
  app: TerminalAppType,
  sessionName: string
): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Opening an external terminal is only supported on macOS.");
  }
  const { command, args } = buildLaunchInvocation(app, sessionName);
  try {
    await runCommand(command, args, { timeoutMs: 10_000 });
  } catch (error) {
    if (app !== "ghostty") {
      throw error;
    }
    const fallback = buildGhosttyFallbackInvocation(sessionName);
    await runCommand(fallback.command, fallback.args, { timeoutMs: 10_000 });
  }
}
