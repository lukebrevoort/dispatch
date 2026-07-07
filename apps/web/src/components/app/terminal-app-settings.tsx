import { useCallback, useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import {
  TERMINAL_APP_LABELS,
  TERMINAL_APP_TYPES,
  type TerminalAppType,
} from "@/lib/terminal-app-types";

type TerminalAppSettingsResponse = {
  enabledTerminalApps: TerminalAppType[];
};

type TerminalAppSettingsProps = {
  enabledTerminalApps: TerminalAppType[];
  onChange: (apps: TerminalAppType[]) => void;
};

export function TerminalAppSettings({
  enabledTerminalApps,
  onChange,
}: TerminalAppSettingsProps): JSX.Element {
  const [apps, setApps] = useState<TerminalAppType[]>(enabledTerminalApps);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setApps(enabledTerminalApps);
  }, [enabledTerminalApps]);

  useEffect(() => {
    let cancelled = false;

    void api<TerminalAppSettingsResponse>("/api/v1/app/settings/terminal-apps")
      .then((data) => {
        if (cancelled) return;
        setApps(data.enabledTerminalApps);
        onChange(data.enabledTerminalApps);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load terminal settings."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onChange]);

  const toggleApp = useCallback(
    async (app: TerminalAppType) => {
      setError("");

      const next = apps.includes(app)
        ? apps.filter((item) => item !== app)
        : [...apps, app];

      setApps(next);
      onChange(next);

      try {
        const data = await api<TerminalAppSettingsResponse>(
          "/api/v1/app/settings/terminal-apps",
          {
            method: "POST",
            body: JSON.stringify({ enabledTerminalApps: next }),
          }
        );
        setApps(data.enabledTerminalApps);
        onChange(data.enabledTerminalApps);
      } catch (err) {
        setApps(apps);
        onChange(apps);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save terminal settings."
        );
      }
    },
    [apps, onChange]
  );

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          Available Terminals
        </div>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          Choose which terminal apps appear in the &ldquo;Open in
          Terminal&rdquo; button on agent cards. The button opens the
          agent&rsquo;s live tmux session in a new window (macOS only); when
          accessing Dispatch remotely it copies the attach command instead. In
          the external window, Ctrl-C stops the agent — closing the window just
          detaches.
        </p>
      </div>

      <div className="max-w-lg space-y-2">
        {TERMINAL_APP_TYPES.map((app) => {
          const checked = apps.includes(app);
          return (
            <label
              key={app}
              className="flex cursor-pointer items-center gap-3 rounded border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => void toggleApp(app)}
                data-testid={`terminal-app-toggle-${app}`}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {TERMINAL_APP_LABELS[app]}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
