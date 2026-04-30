"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  safeParseResponderConfig,
  type ResponderConfig,
  type ResponseSpec,
  type RuleSpec,
  type Method,
  MAX_DELAY_MS,
} from "@/lib/responder";

const METHODS: Method[] = [
  "*",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const emptyResponse = (): ResponseSpec => ({
  status: "200",
  headers: [],
  body: "",
  delayMs: 0,
});

const emptyRule = (): RuleSpec => ({
  ...emptyResponse(),
  method: "*",
  pathGlob: "/**",
});

interface Props {
  hookId: string;
}

export function ResponderDialog({ hookId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [defaultResp, setDefaultResp] = useState<ResponseSpec>(emptyResponse());
  const [rules, setRules] = useState<RuleSpec[]>([]);
  const loadAbort = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    loadAbort.current?.abort();
    const ctrl = new AbortController();
    loadAbort.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/hooks/${hookId}/responder`, {
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        responderConfig: ResponderConfig | null;
      };
      if (ctrl.signal.aborted) return;
      if (data.responderConfig) {
        setEnabled(true);
        setDefaultResp(data.responderConfig.default);
        setRules(data.responderConfig.rules);
      } else {
        setEnabled(false);
        setDefaultResp(emptyResponse());
        setRules([]);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      toast.error("Failed to load responder config");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [hookId]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void loadConfig();
    } else {
      loadAbort.current?.abort();
    }
  };

  const onSave = async () => {
    const payload = enabled
      ? { responderConfig: { default: defaultResp, rules } }
      : { responderConfig: null };
    if (enabled) {
      const check = safeParseResponderConfig(payload.responderConfig);
      if (!check.success) {
        const issue = check.error.issues[0];
        toast.error(`Invalid: ${issue.path.join(".")} — ${issue.message}`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/hooks/${hookId}/responder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `status ${res.status}`);
      }
      toast.success("Responder saved");
      setOpen(false);
    } catch (e) {
      toast.error(
        `Save failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Settings2 className="size-4" />
        <span className="sr-only">Configure responder</span>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Custom responder</DialogTitle>
          <DialogDescription>
            Define what this hook returns to callers. Capture is unaffected —
            every request still appears in the dashboard.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Enable custom responder</span>
            </label>

            {enabled && (
              <>
                <Section title="Default response">
                  <ResponseFields
                    value={defaultResp}
                    onChange={setDefaultResp}
                  />
                </Section>

                <Section
                  title={`Rules (${rules.length})`}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRules((r) => [...r, emptyRule()])}
                    >
                      <Plus className="size-3.5" /> Add rule
                    </Button>
                  }
                >
                  {rules.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No rules — every request returns the default response.
                    </p>
                  )}
                  <div className="flex flex-col gap-3">
                    {rules.map((rule, idx) => (
                      <RuleCard
                        key={idx}
                        rule={rule}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < rules.length - 1}
                        onChange={(next) =>
                          setRules((rs) =>
                            rs.map((r, i) => (i === idx ? next : r)),
                          )
                        }
                        onMoveUp={() =>
                          setRules((rs) => {
                            const c = [...rs];
                            [c[idx - 1], c[idx]] = [c[idx], c[idx - 1]];
                            return c;
                          })
                        }
                        onMoveDown={() =>
                          setRules((rs) => {
                            const c = [...rs];
                            [c[idx], c[idx + 1]] = [c[idx + 1], c[idx]];
                            return c;
                          })
                        }
                        onRemove={() =>
                          setRules((rs) => rs.filter((_, i) => i !== idx))
                        }
                      />
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ResponseFields({
  value,
  onChange,
}: {
  value: ResponseSpec;
  onChange: (next: ResponseSpec) => void;
}) {
  const update = (patch: Partial<ResponseSpec>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Status">
          <input
            value={value.status}
            onChange={(e) => update({ status: e.target.value })}
            className={inputCls}
            placeholder="200"
          />
        </Field>
        <Field label={`Delay (ms, max ${MAX_DELAY_MS})`}>
          <input
            type="number"
            min={0}
            max={MAX_DELAY_MS}
            value={value.delayMs}
            onChange={(e) =>
              update({ delayMs: parseInt(e.target.value, 10) || 0 })
            }
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Headers">
        <div className="flex flex-col gap-1.5">
          {value.headers.length === 0 && (
            <p className="text-xs text-muted-foreground">No headers.</p>
          )}
          {value.headers.map((h, idx) => (
            <div key={idx} className="flex gap-1.5">
              <input
                value={h.name}
                onChange={(e) =>
                  update({
                    headers: value.headers.map((x, i) =>
                      i === idx ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
                placeholder="X-Custom"
                className={`${inputCls} flex-[1]`}
              />
              <input
                value={h.value}
                onChange={(e) =>
                  update({
                    headers: value.headers.map((x, i) =>
                      i === idx ? { ...x, value: e.target.value } : x,
                    ),
                  })
                }
                placeholder="value (templates ok)"
                className={`${inputCls} flex-[2]`}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update({
                    headers: value.headers.filter((_, i) => i !== idx),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                headers: [...value.headers, { name: "", value: "" }],
              })
            }
          >
            <Plus className="size-3.5" /> Add header
          </Button>
        </div>
      </Field>

      <Field label="Body (templates ok)">
        <textarea
          value={value.body}
          onChange={(e) => update({ body: e.target.value })}
          rows={4}
          placeholder='{ "id": "{{request.json.id}}", "at": "{{now}}" }'
          className={`${inputCls} resize-y font-mono`}
        />
      </Field>
    </div>
  );
}

function RuleCard({
  rule,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  rule: RuleSpec;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: RuleSpec) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-border/40 bg-muted/20 p-2.5">
      <div className="mb-2 flex items-end gap-1.5">
        <Field label="Method">
          <select
            value={rule.method}
            onChange={(e) =>
              onChange({ ...rule, method: e.target.value as Method })
            }
            className={`${inputCls} w-28`}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex-1">
          <Field label="Path glob">
            <input
              value={rule.pathGlob}
              onChange={(e) => onChange({ ...rule, pathGlob: e.target.value })}
              placeholder="/users/*"
              className={`${inputCls} font-mono`}
            />
          </Field>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canMoveUp}
          onClick={onMoveUp}
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canMoveDown}
          onClick={onMoveDown}
        >
          <ChevronDown className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <ResponseFields
        value={rule}
        onChange={(next) => onChange({ ...rule, ...next })}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-sm outline-none focus:border-primary";
