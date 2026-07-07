import { describe, expect, it } from "vitest";

import {
  buildGhosttyFallbackInvocation,
  buildLaunchInvocation,
} from "../src/terminal/external-launch.js";
import { sanitizeEnabledTerminalApps } from "../src/terminal-app-settings.js";

describe("buildLaunchInvocation", () => {
  it("builds a Ghostty invocation via AppleScript new window (running instance)", () => {
    const { command, args } = buildLaunchInvocation(
      "ghostty",
      "dispatch_agt_abc123def456_my-task"
    );
    expect(command).toBe("osascript");
    expect(args[1]).toBe('tell application "Ghostty"');
    const newWindow = args[5];
    expect(newWindow).toContain("new window with configuration");
    expect(newWindow).toContain(
      "tmux attach-session -t 'dispatch_agt_abc123def456_my-task'"
    );
    // shell `\;` must survive AppleScript escaping as `\\;`
    expect(newWindow).toContain("\\\\; display-message");
  });

  it("builds the pre-1.3 Ghostty fallback with tmux args discrete (no shell)", () => {
    const { command, args } = buildGhosttyFallbackInvocation(
      "dispatch_agt_abc123def456_my-task"
    );
    expect(command).toBe("open");
    expect(args.slice(0, 5)).toEqual([
      "-na",
      "Ghostty",
      "--args",
      "-e",
      "tmux",
    ]);
    expect(args).toContain("attach-session");
    expect(args).toContain("dispatch_agt_abc123def456_my-task");
    // tmux command separator must be its own argument, never shell-joined
    expect(args).toContain(";");
    expect(args).toContain("display-message");
  });

  it("builds a Terminal.app invocation via osascript do script", () => {
    const { command, args } = buildLaunchInvocation(
      "terminal",
      "dispatch_agt_abc123def456"
    );
    expect(command).toBe("osascript");
    expect(args[1]).toContain('tell application "Terminal" to do script');
    expect(args[1]).toContain(
      "tmux attach-session -t 'dispatch_agt_abc123def456'"
    );
    expect(args[3]).toContain("activate");
  });

  it("rejects session names that could escape quoting", () => {
    expect(() => buildLaunchInvocation("ghostty", "bad name")).toThrow(
      /Unsafe tmux session name/
    );
    expect(() => buildLaunchInvocation("terminal", "x'; rm -rf ~'")).toThrow(
      /Unsafe tmux session name/
    );
    expect(() => buildLaunchInvocation("ghostty", "")).toThrow(
      /Unsafe tmux session name/
    );
  });
});

describe("sanitizeEnabledTerminalApps", () => {
  it("returns an empty array when the value is not an array", () => {
    expect(sanitizeEnabledTerminalApps(undefined)).toEqual([]);
    expect(sanitizeEnabledTerminalApps("ghostty")).toEqual([]);
  });

  it("filters unknown values and removes duplicates", () => {
    expect(
      sanitizeEnabledTerminalApps([
        "ghostty",
        "terminal",
        "ghostty",
        "kitty",
        1,
      ])
    ).toEqual(["ghostty", "terminal"]);
  });
});
