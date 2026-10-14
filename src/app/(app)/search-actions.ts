"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = { id: string; kind: "lead" | "project" | "actor"; title: string; subtitle: string | null; href: string };

/** Căutare globală (⌘K): lead-uri, proiecte, actori — respectă rolul prin RLS. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const profile = await requireProfile();
  const q = query.trim().replace(/[%,()]/g, " ").slice(0, 60);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");

  const [leads, projects, actors] = await Promise.all([
    profile.role !== "productie"
      ? supabase
          .from("leads")
          .select("id, company_name, owner_name, website")
          .or(
            [`company_name.ilike.${like}`, `owner_name.ilike.${like}`, `website.ilike.${like}`, `email.ilike.${like}`, digits.length >= 4 ? `phone1.ilike.%${digits}%` : null]
              .filter(Boolean)
              .join(","),
          )
          .limit(6)
          .returns<{ id: string; company_name: string; owner_name: string | null; website: string | null }[]>()
      : null,
    profile.role !== "setter"
      ? supabase
          .from("projects")
          .select("id, client_name, description")
          .or(`client_name.ilike.${like},description.ilike.${like}`)
          .limit(6)
          .returns<{ id: string; client_name: string; description: string | null }[]>()
      : null,
    profile.role !== "setter"
      ? supabase.from("actors").select("id, name, instagram").ilike("name", like).limit(4).returns<{ id: string; name: string; instagram: string | null }[]>()
      : null,
  ]);

  return [
    ...(projects?.data ?? []).map((p) => ({ id: p.id, kind: "project" as const, title: p.client_name, subtitle: p.description, href: `/proiecte/${p.id}` })),
    ...(leads?.data ?? []).map((l) => ({
      id: l.id,
      kind: "lead" as const,
      title: l.company_name,
      subtitle: [l.owner_name, l.website].filter(Boolean).join(" · ") || null,
      href: `/leaduri?lead=${l.id}`,
    })),
    ...(actors?.data ?? []).map((a) => ({ id: a.id, kind: "actor" as const, title: a.name, subtitle: a.instagram, href: `/actori/${a.id}` })),
  ];
}
