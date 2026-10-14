"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/color-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createListItem, deleteListItem, reorderList, updateListItem, type ActionResult } from "./actions";
import type { ListTable } from "./lists";

export type ListField =
  | { key: string; label: string; type: "color" }
  | { key: string; label: string; type: "bool"; hint?: string }
  | { key: string; label: string; type: "number"; placeholder?: string; suffix?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; placeholder?: string };

export type ListRow = { id: string; name: string; [key: string]: unknown };

const NONE = "__none__";

/**
 * Editor pentru listele din Setări: redenumire, culoare, flag-uri, ordine, adăugare, ștergere.
 * Fiecare modificare se salvează imediat.
 */
export function ListEditor({
  table,
  rows,
  fields = [],
  addPlaceholder = "Element nou",
  locked = {},
  createValues = {},
}: {
  table: ListTable;
  rows: ListRow[];
  fields?: ListField[];
  addPlaceholder?: string;
  /** Rânduri care nu pot fi șterse (ex. tipul de cost „comision”): id → motiv. */
  locked?: Record<string, string>;
  /** Valori adăugate la fiecare element nou (ex. serviciul de care ține un pas). */
  createValues?: Record<string, unknown>;
}) {
  const [, startTransition] = useTransition();
  const [optimisticRows, applyOptimistic] = useOptimistic(
    rows,
    (
      current: ListRow[],
      action:
        { type: "update"; id: string; values: Record<string, unknown> } | { type: "order"; ids: string[] } | { type: "delete"; id: string },
    ) => {
      if (action.type === "update") {
        return current.map((r) => {
          if (r.id === action.id) return { ...r, ...action.values };
          // Doar un status implicit — reflectăm imediat și în UI.
          if (action.values.is_default === true) return { ...r, is_default: false };
          return r;
        });
      }
      if (action.type === "delete") return current.filter((r) => r.id !== action.id);
      const byId = new Map(current.map((r) => [r.id, r]));
      return action.ids.map((id) => byId.get(id)!).filter(Boolean);
    },
  );
  const [newName, setNewName] = useState("");

  function run(optimistic: Parameters<typeof applyOptimistic>[0] | null, action: () => Promise<ActionResult>, success?: string) {
    startTransition(async () => {
      if (optimistic) applyOptimistic(optimistic);
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else if (success) toast.success(success);
    });
  }

  function update(row: ListRow, values: Record<string, unknown>) {
    run({ type: "update", id: row.id, values }, () => updateListItem(table, row.id, values));
  }

  function move(index: number, delta: number) {
    const ids = optimisticRows.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    run({ type: "order", ids }, () => reorderList(table, ids));
  }

  function remove(row: ListRow) {
    if (!confirm(`Ștergi „${row.name}”?`)) return;
    run({ type: "delete", id: row.id }, () => deleteListItem(table, row.id), "Șters");
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    const defaults: Record<string, unknown> = { ...createValues, name };
    if (fields.some((f) => f.key === "color")) defaults.color = "#64748b";
    setNewName("");
    run(null, () => createListItem(table, defaults), "Adăugat");
  }

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-16 px-2 py-2 text-left font-medium">Ordine</th>
              <th className="min-w-44 px-2 py-2 text-left font-medium">Nume</th>
              {fields.map((f) => (
                <th key={f.key} className="px-2 py-2 text-left font-medium whitespace-nowrap">
                  {f.type === "bool" && f.hint ? (
                    <Tooltip>
                      <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">{f.label}</TooltipTrigger>
                      <TooltipContent className="max-w-60">{f.hint}</TooltipContent>
                    </Tooltip>
                  ) : (
                    f.label
                  )}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {optimisticRows.map((row, index) => {
              const lockReason = locked[row.id];
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-2 py-1.5">
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label="Mută sus"
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        disabled={index === optimisticRows.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Mută jos"
                      >
                        <ArrowDownIcon />
                      </Button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      key={`${row.id}-${row.name}`}
                      defaultValue={row.name}
                      className="h-8"
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== row.name) update(row, { name: value });
                        else e.target.value = row.name;
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                  </td>
                  {fields.map((f) => (
                    <td key={f.key} className="px-2 py-1.5">
                      <FieldCell field={f} row={row} onChange={(value) => update(row, { [f.key]: value })} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">
                    {lockReason ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex size-7 items-center justify-center text-muted-foreground/40">
                            <Trash2Icon className="size-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{lockReason}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(row)}
                        aria-label="Șterge"
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form
        className="flex gap-2 border-t bg-muted/30 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={addPlaceholder}
          className="h-8 max-w-xs bg-card"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!newName.trim()}>
          <PlusIcon /> Adaugă
        </Button>
      </form>
    </div>
  );
}

function FieldCell({ field, row, onChange }: { field: ListField; row: ListRow; onChange: (value: unknown) => void }) {
  const value = row[field.key];

  switch (field.type) {
    case "color":
      return <ColorPicker value={String(value)} onChange={onChange} label={field.label} />;
    case "bool":
      return (
        <div className="flex justify-center">
          <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} aria-label={field.label} />
        </div>
      );
    case "number":
      return (
        <div className="flex items-center gap-1.5">
          <Input
            key={`${row.id}-${String(value)}`}
            type="number"
            inputMode="numeric"
            defaultValue={value === null || value === undefined ? "" : String(value)}
            placeholder={field.placeholder}
            className={cn("h-8 w-20")}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const next = raw === "" ? null : Number(raw);
              if (next !== value) onChange(next);
            }}
          />
          {field.suffix ? <span className="text-xs text-muted-foreground">{field.suffix}</span> : null}
        </div>
      );
    case "select":
      return (
        <Select value={value ? String(value) : NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
          <SelectTrigger size="sm" className="min-w-44">
            <SelectValue>{field.options.find((o) => o.value === value)?.label ?? field.placeholder ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{field.placeholder ?? "—"}</SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
  }
}
