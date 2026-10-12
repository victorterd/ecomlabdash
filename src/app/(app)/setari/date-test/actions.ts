"use server";

import { addDays, format, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message: string } | { ok: false; error: string };

const COMPANIES = [
  ["Atelier Lumina SRL", "Ana Popescu"],
  ["Verde Natural SRL", "Mihai Ionescu"],
  ["Casa Bunicii Shop SRL", "Elena Dumitru"],
  ["Pet Joy Store SRL", "Radu Stan"],
  ["Urban Sneakers SRL", "Andrei Marin"],
  ["Kids Corner Online SRL", "Ioana Rusu"],
  ["Cafea de Specialitate SRL", "Bogdan Matei"],
  ["Ceramica Artizanală SRL", "Maria Georgescu"],
  ["Sport Max Online SRL", "Cristian Lazăr"],
  ["Bijuterii Fine SRL", "Diana Tudor"],
  ["Home Deco Plus SRL", "Alexandru Pop"],
  ["Beauty Box RO SRL", "Larisa Enache"],
  ["Auto Piese Rapid SRL", "Florin Neagu"],
  ["Ceai și Arome SRL", "Simona Barbu"],
  ["Gadget Hub SRL", "Vlad Moldovan"],
  ["Grădina Mea SRL", "Carmen Ilie"],
  ["Fashion Nord SRL", "Oana Preda"],
  ["Bio Cosmetice SRL", "Daniel Constantin"],
  ["Jucării Creative SRL", "Raluca Stoica"],
  ["Outdoor Gear SRL", "George Munteanu"],
  ["Lenjerii Premium SRL", "Irina Cristea"],
  ["Suplimente Fit SRL", "Paul Dobre"],
  ["Mobila Smart SRL", "Adina Sandu"],
  ["Vinoteca Online SRL", "Sorin Ene"],
];

const NOTES = [
  "Are magazin pe Shopify, rulează deja Meta Ads. Interesat de UGC.",
  "Nu a răspuns de 2 ori. Revin săptămâna viitoare.",
  "Vrea ofertă pentru 10 clipuri, buget mic.",
  "Lucrează cu altă agenție, contract până în decembrie.",
  "Cald — a cerut exemple din nișa lor.",
  null,
  "Recepția a zis să trimit mail la office.",
];

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ srl$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateTestData(): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: statuses }, { data: sources }] = await Promise.all([
    supabase.from("lead_statuses").select("id, is_follow_up, is_won, is_closed").order("sort_order"),
    supabase.from("lead_sources").select("id").eq("active", true).order("sort_order"),
  ]);
  if (!statuses?.length) return { ok: false, error: "Nu există statusuri de lead." };

  const today = parseISO(todayISO());
  const offsets = [-5, -2, -1, 0, 0, 1, 3, 6, 10, null];
  const leads = COMPANIES.map(([company, owner], i) => {
    const status = statuses[i % statuses.length]!;
    const offset = offsets[i % offsets.length];
    const followUp = status.is_closed || offset === null ? null : format(addDays(today, offset), "yyyy-MM-dd");
    const s = slug(company!);
    return {
      company_name: company!,
      owner_name: owner!,
      website: `https://demo-${s}.ro`,
      email: `contact@demo-${s}.ro`,
      phone1: `07${String(20 + i).padStart(2, "0")}000${String(100 + i).padStart(3, "0")}`,
      phone2: i % 3 === 0 ? `07${String(40 + i).padStart(2, "0")}000${String(200 + i).padStart(3, "0")}` : null,
      status_id: status.id,
      source_id: sources?.length ? sources[i % sources.length]!.id : null,
      called_by: i % 2 === 0 ? "Setter" : null,
      follow_up_date: followUp,
      notes: NOTES[i % NOTES.length],
      is_seed: true,
    };
  });

  const { error } = await supabase.from("leads").insert(leads);
  if (error) return { ok: false, error: error.message };

  const production = await seedProduction(today);
  await seedFinance(today);
  revalidatePath("/", "layout");
  if (!production.ok) return { ok: true, message: `Am adăugat ${leads.length} lead-uri de test. Proiecte: ${production.error}` };
  return {
    ok: true,
    message: `Am adăugat ${leads.length} lead-uri, ${production.projects} proiecte și ${production.actors} actori de test.`,
  };
}

export async function deleteTestData(): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  // Proiectele șterse iau cu ele tranșele, costurile, termenele și filmările lor.
  const projects = await supabase.from("projects").delete({ count: "exact" }).eq("is_seed", true);
  await supabase.from("shoots").delete().eq("is_seed", true);
  await supabase.from("transactions").delete().eq("is_seed", true);
  const actors = await supabase.from("actors").delete({ count: "exact" }).eq("is_seed", true);
  await supabase.from("recurring_expenses").delete().eq("is_seed", true);
  await supabase.from("forecast_entries").delete().eq("is_seed", true);
  const { error, count } = await supabase.from("leads").delete({ count: "exact" }).eq("is_seed", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Am șters ${count ?? 0} lead-uri, ${projects.count ?? 0} proiecte și ${actors.count ?? 0} actori de test.`,
  };
}

// ---------------------------------------------------------------------
// Proiecte, actori, filmări, tranșe, costuri
// ---------------------------------------------------------------------

const ACTORS = [
  { name: "Bianca Ene", rate: "350", rate_unit: "clip", rating: 5, instagram: "@bianca.ugc" },
  { name: "Tudor Vasile", rate: "300", rate_unit: "clip", rating: 4, instagram: "@tudor.creates" },
  { name: "Ilinca Marin", rate: "1200", rate_unit: "zi", rating: 4, instagram: "@ilinca.m" },
  { name: "Matei Pavel", rate: "250", rate_unit: "clip", rating: 3, instagram: "@matei.pavel" },
  { name: "Sara Neagu", rate: "1500", rate_unit: "zi", rating: 5, instagram: "@sara.neagu" },
] as const;

type SeedProject = {
  client: string;
  description: string;
  /** Serviciile proiectului și pasul la care s-a ajuns (null = toți pașii bifați). */
  services: { name: string; current: string | null }[];
  type?: "proiect" | "retainer";
  start: number;
  deadline: number;
  value: number;
  installments: { amount: number; due: number; paid?: number }[];
  costs: { type: string; person: string; amount: number; due: number; paid?: number }[];
  actors: number[];
  shoots: { day: number; time: string; location: string; actors: number[] }[];
};

const PROJECTS: SeedProject[] = [
  {
    client: "Atelier Lumina SRL",
    description: "20 clipuri video UGC + 5 statice",
    services: [
      { name: "Clipuri video", current: "Filmare" },
      { name: "Statice", current: "Design" },
    ],
    start: -14,
    deadline: 10,
    value: 12000,
    installments: [
      { amount: 6000, due: -14, paid: -13 },
      { amount: 6000, due: 10 },
    ],
    costs: [
      { type: "Cameraman", person: "Radu Filip", amount: 1200, due: -2, paid: -2 },
      { type: "Editor", person: "Ioana Edit", amount: 2000, due: 12 },
      { type: "Scenarist", person: "Paul Script", amount: 800, due: -8, paid: -7 },
    ],
    actors: [0, 1],
    shoots: [
      { day: 1, time: "10:00", location: "Studio Floreasca", actors: [0, 1] },
      { day: -2, time: "09:30", location: "Studio Floreasca", actors: [0] },
    ],
  },
  {
    client: "Pet Joy Store SRL",
    description: "10 clipuri TikTok cu produse pentru animale",
    services: [{ name: "Clipuri video", current: "Scripturi" }],
    start: -12,
    deadline: 4,
    value: 6500,
    installments: [
      { amount: 3250, due: -12, paid: -11 },
      { amount: 3250, due: 4 },
    ],
    costs: [{ type: "Scenarist", person: "Paul Script", amount: 600, due: 2 }],
    actors: [3],
    shoots: [{ day: 3, time: "11:00", location: "La client", actors: [3] }],
  },
  {
    client: "Urban Sneakers SRL",
    description: "15 clipuri video + hook-uri A/B",
    services: [{ name: "Clipuri video", current: "Editare" }],
    start: -24,
    deadline: 6,
    value: 9800,
    installments: [
      { amount: 4900, due: -24, paid: -22 },
      { amount: 4900, due: 6 },
    ],
    costs: [
      { type: "Actor", person: "Ilinca Marin", amount: 1200, due: -6, paid: -6 },
      { type: "Cameraman", person: "Radu Filip", amount: 900, due: -6, paid: -5 },
      { type: "Editor", person: "Ioana Edit", amount: 1800, due: 7 },
    ],
    actors: [2],
    shoots: [{ day: -6, time: "08:30", location: "Centrul Vechi", actors: [2] }],
  },
  {
    client: "Beauty Box RO SRL",
    description: "30 clipuri UGC pentru campania de iarnă",
    services: [{ name: "Clipuri video", current: null }],
    start: -50,
    deadline: -12,
    value: 15000,
    installments: [
      { amount: 7500, due: -50, paid: -49 },
      { amount: 7500, due: -12, paid: -10 },
    ],
    costs: [
      { type: "Actor", person: "Sara Neagu", amount: 3000, due: -30, paid: -30 },
      { type: "Editor", person: "Ioana Edit", amount: 2500, due: -14, paid: -13 },
    ],
    actors: [4, 0],
    shoots: [{ day: -30, time: "10:00", location: "Studio Floreasca", actors: [4, 0] }],
  },
  {
    client: "Cafea de Specialitate SRL",
    description: "Retainer: 8 clipuri pe lună",
    services: [{ name: "Clipuri video", current: "Semnat" }],
    type: "retainer",
    start: 0,
    deadline: 30,
    value: 12000,
    installments: [
      { amount: 4000, due: 2 },
      { amount: 4000, due: 32 },
      { amount: 4000, due: 62 },
    ],
    costs: [],
    actors: [],
    shoots: [{ day: 8, time: "09:00", location: "Cafeneaua clientului", actors: [] }],
  },
];

async function seedProduction(today: Date): Promise<{ ok: true; projects: number; actors: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const day = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");

  const [{ data: services, error: servicesError }, { data: steps }, { data: costTypes }] = await Promise.all([
    supabase.from("services").select("id, name"),
    supabase.from("service_steps").select("service_id, name, sort_order, default_offset_days").order("sort_order"),
    supabase.from("cost_types").select("id, name, default_category_id"),
  ]);
  if (servicesError) return { ok: false, error: "rulează întâi migrația 20261014000006_services.sql." };
  const costType = (name: string) => costTypes?.find((c) => c.name === name);

  const { data: actors, error: actorsError } = await supabase
    .from("actors")
    .insert(ACTORS.map((a) => ({ ...a, phone: null, is_seed: true })))
    .select("id, name");
  if (actorsError || !actors) return { ok: false, error: actorsError?.message ?? "actori" };

  for (const [index, p] of PROJECTS.entries()) {
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        client_name: p.client,
        description: p.description,
        type: p.type ?? "proiect",
        start_date: day(p.start),
        deadline: day(p.deadline),
        board_position: (index + 1) * 1000,
        is_seed: true,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !project) return { ok: false, error: error?.message ?? "proiect" };

    // Serviciile cu pașii lor: tot ce e înaintea pasului curent e bifat.
    for (const ps of p.services) {
      const service = services?.find((s) => s.name === ps.name);
      if (!service) continue;
      await supabase.from("project_services").insert({ project_id: project.id, service_id: service.id });
      const serviceSteps = (steps ?? []).filter((st) => st.service_id === service.id);
      const currentIndex = ps.current ? serviceSteps.findIndex((st) => st.name === ps.current) : serviceSteps.length;
      await supabase.from("project_tasks").insert(
        serviceSteps.map((st, i) => {
          const due = st.default_offset_days === null ? null : p.start + st.default_offset_days;
          return {
            project_id: project.id,
            service_id: service.id,
            title: st.name,
            sort_order: st.sort_order,
            due_date: due === null ? null : day(due),
            done_at: i < currentIndex ? day(Math.min(due ?? 0, 0)) : null,
          };
        }),
      );
    }

    await supabase.from("project_finance").insert({ project_id: project.id, contract_value: p.value, setter_name: "Setter" });

    const tx = [
      ...p.installments.map((i) => ({
        type: "income",
        kind: "installment",
        amount: i.amount,
        due_date: day(i.due),
        status: i.paid !== undefined ? "realized" : "planned",
        realized_date: i.paid !== undefined ? day(i.paid) : null,
      })),
      ...p.costs.map((c) => ({
        type: "expense",
        kind: "project_cost",
        amount: c.amount,
        due_date: day(c.due),
        status: c.paid !== undefined ? "realized" : "planned",
        realized_date: c.paid !== undefined ? day(c.paid) : null,
        cost_type_id: costType(c.type)?.id ?? null,
        category_id: costType(c.type)?.default_category_id ?? null,
        person: c.person,
      })),
    ].map((t) => ({ ...t, project_id: project.id, is_seed: true }));
    if (tx.length) await supabase.from("transactions").insert(tx);

    if (p.actors.length) {
      await supabase
        .from("project_actors")
        .insert(p.actors.map((i) => ({ project_id: project.id, actor_id: actors[i]!.id, agreed_fee: ACTORS[i]!.rate })));
    }

    for (const s of p.shoots) {
      const { data: shoot } = await supabase
        .from("shoots")
        .insert({ project_id: project.id, shoot_date: day(s.day), start_time: s.time, location: s.location, is_seed: true })
        .select("id")
        .single<{ id: string }>();
      if (shoot && s.actors.length) {
        await supabase.from("shoot_actors").insert(s.actors.map((i) => ({ shoot_id: shoot.id, actor_id: actors[i]!.id })));
      }
    }
  }

  return { ok: true, projects: PROJECTS.length, actors: actors.length };
}

// ---------------------------------------------------------------------
// Financiar: cheltuieli manuale, recurente, forecast
// ---------------------------------------------------------------------

async function seedFinance(today: Date) {
  const supabase = await createClient();
  const day = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");
  const { data: categories } = await supabase.from("expense_categories").select("id, name");
  const cat = (pattern: RegExp) => categories?.find((c) => pattern.test(c.name))?.id ?? categories?.[0]?.id ?? null;
  const ads = cat(/ads/i);
  const soft = cat(/soft/i);
  const accounting = cat(/contab/i);

  const manual = [
    { amount: 1500, offset: -40, category: ads, description: "TikTok Ads", realized: true },
    { amount: 1800, offset: -10, category: ads, description: "TikTok Ads", realized: true },
    { amount: 2000, offset: 20, category: ads, description: "TikTok Ads", realized: false },
    { amount: 450, offset: -35, category: soft, description: "CapCut Pro + Canva + Google Workspace", realized: true },
    { amount: 450, offset: -5, category: soft, description: "CapCut Pro + Canva + Google Workspace", realized: true },
    { amount: 1200, offset: -15, category: soft, description: "Laptop rate (personal pe firmă)", realized: true, personal: true },
  ].map((t) => ({
    type: "expense",
    kind: "manual",
    amount: t.amount,
    due_date: day(t.offset),
    status: t.realized ? "realized" : "planned",
    realized_date: t.realized ? day(t.offset) : null,
    category_id: t.category,
    scope: t.personal ? "personal" : "business",
    description: t.description,
    is_seed: true,
  }));
  await supabase.from("transactions").insert(manual);

  await supabase.from("recurring_expenses").insert({
    description: "Contabilitate",
    amount: 600,
    category_id: accounting,
    day_of_month: 25,
    start_month: format(today, "yyyy-MM-01"),
    is_seed: true,
  });
  await supabase.rpc("generate_recurring_transactions", { p_months: 12 });

  const forecast = Array.from({ length: 6 }, (_, i) => {
    const month = format(new Date(today.getFullYear(), today.getMonth() + i, 1), "yyyy-MM-dd");
    return [
      { month, type: "income", category_id: null, amount: 25000 + i * 2000, is_seed: true },
      { month, type: "expense", category_id: ads, amount: 2000, is_seed: true },
      { month, type: "expense", category_id: cat(/produc/i), amount: 8000 + i * 500, is_seed: true },
    ];
  }).flat();
  await supabase.from("forecast_entries").upsert(forecast, { onConflict: "month,type,category_id", ignoreDuplicates: true });
}
