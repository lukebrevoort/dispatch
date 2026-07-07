import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, SquareTerminal } from "lucide-react";
import { siGhostty } from "simple-icons";
import { useAtom } from "jotai";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { preferredTerminalAppAtom } from "@/lib/store";
import {
  type TerminalAppType,
  TERMINAL_APP_LABELS,
  TERMINAL_APP_TYPES,
} from "@/lib/terminal-app-types";
import { cn } from "@/lib/utils";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function isLoopbackHost(): boolean {
  if (typeof window === "undefined") return false;
  return LOOPBACK_HOSTS.has(window.location.hostname);
}

function TerminalAppIcon({
  app,
  className,
}: {
  app: TerminalAppType;
  className?: string;
}): JSX.Element {
  if (app === "ghostty") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn("h-3 w-3", className)}
        fill="currentColor"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: `<path d="${siGhostty.path}" />` }}
      />
    );
  }
  return <SquareTerminal className={cn("h-3 w-3", className)} />;
}

const PILL_BASE =
  "h-auto min-h-6 border border-border bg-muted/35 px-2 py-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground";

export function TerminalLaunchButton({
  agentId,
  tmuxSession,
  enabledTerminalApps = [],
}: {
  agentId: string;
  tmuxSession: string | null;
  enabledTerminalApps?: TerminalAppType[];
}): JSX.Element | null {
  const [preferredApp, setPreferredApp] = useAtom(preferredTerminalAppAtom);
  const [copied, setCopied] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoopback = isLoopbackHost();
  const orderedEnabled = TERMINAL_APP_TYPES.filter((app) =>
    enabledTerminalApps.includes(app)
  );

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  // No session to attach to (inert runtime, stopped agent) or the feature is
  // switched off — the IDE pill's settings CTA already covers discovery.
  if (!tmuxSession || orderedEnabled.length === 0) return null;

  const resetAfter = (fn: () => void) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(fn, 2000);
  };

  // Remote access: the server can't open a window on this screen, but the
  // session is one ssh + attach away. Hand over the command instead.
  if (!onLoopback) {
    const attachCommand = `tmux attach-session -t ${tmuxSession}`;
    const copyCommand = () => {
      void navigator.clipboard.writeText(attachCommand).then(() => {
        setCopied(true);
        resetAfter(() => setCopied(false));
      });
    };
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCommand}
            aria-label="Copy tmux attach command"
            data-testid="terminal-launch-copy"
            className={cn("group rounded-full", PILL_BASE)}
          >
            {copied ? (
              <Check className="h-3 w-3 text-status-done" />
            ) : (
              <>
                <SquareTerminal className="h-3 w-3 group-hover:hidden group-focus-visible:hidden" />
                <Copy className="hidden h-3 w-3 group-hover:block group-focus-visible:block" />
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {copied
            ? "Copied — run it on the Dispatch host"
            : "Copy tmux attach command (run on the Dispatch host, e.g. over ssh)"}
        </TooltipContent>
      </Tooltip>
    );
  }

  const activeApp = orderedEnabled.includes(preferredApp)
    ? preferredApp
    : orderedEnabled[0];
  const showPicker = orderedEnabled.length > 1;

  const launch = (app: TerminalAppType) => {
    setLaunchError("");
    void api<null>(`/api/v1/agents/${agentId}/terminal/open-external`, {
      method: "POST",
      body: JSON.stringify({ app }),
    }).catch((err: unknown) => {
      setLaunchError(
        err instanceof Error ? err.message : "Failed to open terminal."
      );
      resetAfter(() => setLaunchError(""));
    });
  };

  return (
    <div className="inline-flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => launch(activeApp)}
            aria-label={`Open in ${TERMINAL_APP_LABELS[activeApp]}`}
            data-testid="terminal-launch-button"
            className={cn(
              "group relative",
              PILL_BASE,
              launchError && "text-destructive",
              "before:absolute before:inset-y-[-12px] before:left-[-8px] before:content-['']",
              showPicker
                ? "rounded-l-full rounded-r-none border-r-0 before:right-0"
                : "rounded-full before:right-[-8px]"
            )}
          >
            <TerminalAppIcon app={activeApp} className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {launchError || `Open in ${TERMINAL_APP_LABELS[activeApp]}`}
        </TooltipContent>
      </Tooltip>
      {showPicker ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Choose terminal"
              data-testid="terminal-launch-dropdown"
              className={cn(
                "relative rounded-l-none rounded-r-full px-1.5",
                PILL_BASE,
                "before:absolute before:inset-y-[-12px] before:left-0 before:right-[-8px] before:content-['']"
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {orderedEnabled.map((app) => (
              <DropdownMenuItem
                key={app}
                className="flex items-center gap-2 whitespace-nowrap text-foreground"
                data-testid={`terminal-launch-option-${app}`}
                onSelect={() => {
                  setPreferredApp(app);
                  launch(app);
                }}
              >
                <TerminalAppIcon
                  app={app}
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
                <span>Open in {TERMINAL_APP_LABELS[app]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
