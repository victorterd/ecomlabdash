"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { ClapperboardIcon, CornerDownLeftIcon, Loader2Icon, PhoneCallIcon, SearchIcon, UserRoundIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { searchEverything, type SearchHit } from "@/app/(app)/search-actions";
import type { UserRole } from "@/lib/types";
import { navForRole } from "./nav";
import { quickActionsFor } from "./quick-actions";

const CommandContext = createContext<() => void>(() => {});
export const useOpenCommandMenu = () => useContext(CommandContext);

const HIT_ICON = { lead: PhoneCallIcon, project: ClapperboardIcon, actor: UserRoundIcon };
const HIT_GROUP = { project: "Proiecte", lead: "Lead-uri", actor: "Actori" } as const;

const itemClass =
  "flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none select-none data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupClass = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase";

/** Căutare globală ⌘K / Ctrl+K: pagini, acțiuni rapide, lead-uri, proiecte, actori. */
export function CommandMenuProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const id = setTimeout(() => startSearch(async () => setHits(await searchEverything(query))), 180);
    return () => clearTimeout(id);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const pages = navForRole(role);
  const actions = quickActionsFor(role);
  const results = query.trim().length >= 2 ? hits : [];

  return (
    <CommandContext value={() => setOpen(true)}>
      {children}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setHits([]);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <DialogPrimitive.Title className="sr-only">Caută</DialogPrimitive.Title>
            <Command shouldFilter={false} loop>
              <div className="flex items-center gap-3 border-b px-4">
                {searching ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : <SearchIcon className="size-4 text-muted-foreground" />}
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Caută lead-uri, proiecte, actori sau sari la o pagină…"
                  className="h-13 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">ESC</kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                {results.length === 0 && query.trim().length >= 2 && !searching ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">Niciun rezultat pentru „{query}”.</div>
                ) : null}
                {(["project", "lead", "actor"] as const).map((kind) => {
                  const group = results.filter((h) => h.kind === kind);
                  if (!group.length) return null;
                  const Icon = HIT_ICON[kind];
                  return (
                    <Command.Group key={kind} heading={HIT_GROUP[kind]} className={groupClass}>
                      {group.map((h) => (
                        <Command.Item key={h.id} value={`${kind}-${h.id}`} onSelect={() => go(h.href)} className={itemClass}>
                          <Icon />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{h.title}</span>
                            {h.subtitle ? <span className="ml-2 text-muted-foreground">{h.subtitle}</span> : null}
                          </span>
                          <CornerDownLeftIcon className="opacity-0 [[data-selected=true]_&]:opacity-100" />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
                {query.trim().length < 2 ? (
                  <>
                    <Command.Group heading="Acțiuni rapide" className={groupClass}>
                      {actions.map((a) => (
                        <Command.Item key={a.href} value={`action-${a.href}`} onSelect={() => go(a.href)} className={itemClass}>
                          <a.icon />
                          {a.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                    <Command.Group heading="Pagini" className={groupClass}>
                      {pages.map((p) => (
                        <Command.Item key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)} className={itemClass}>
                          <p.icon />
                          {p.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </>
                ) : null}
              </Command.List>
              <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
                <span>
                  <kbd className="font-sans">↑↓</kbd> navighează
                </span>
                <span>
                  <kbd className="font-sans">↵</kbd> deschide
                </span>
                <span className="ml-auto">
                  <kbd className="font-sans">⌘K</kbd> oricând
                </span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandContext>
  );
}
