import { z } from "zod";

/** Listele configurabile din Setări și câmpurile pe care le poate edita utilizatorul. */
const name = z.string().trim().min(1, "Numele e obligatoriu").max(80);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Culoare invalidă");

export const LIST_SCHEMAS = {
  lead_statuses: z
    .object({
      name,
      color,
      is_default: z.boolean(),
      is_follow_up: z.boolean(),
      is_won: z.boolean(),
      is_closed: z.boolean(),
    })
    .partial(),
  lead_sources: z.object({ name, active: z.boolean() }).partial(),
  services: z.object({ name, color, active: z.boolean() }).partial(),
  service_steps: z
    .object({
      name,
      service_id: z.uuid(),
      default_offset_days: z.number().int().min(0).max(365).nullable(),
    })
    .partial(),
  expense_categories: z.object({ name, color, active: z.boolean() }).partial(),
  cost_types: z.object({ name, active: z.boolean(), default_category_id: z.uuid().nullable() }).partial(),
} as const;

export type ListTable = keyof typeof LIST_SCHEMAS;

export function isListTable(value: string): value is ListTable {
  return value in LIST_SCHEMAS;
}
