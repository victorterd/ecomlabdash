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
  revalidatePath("/", "layout");
  return { ok: true, message: `Am adăugat ${leads.length} lead-uri de test.` };
}

export async function deleteTestData(): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error, count } = await supabase.from("leads").delete({ count: "exact" }).eq("is_seed", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `Am șters ${count ?? 0} lead-uri de test.` };
}
