"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { MoneyInput } from "@/components/money-input";
import { ServicePicker } from "@/components/service-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber, formatRON, toDecimal } from "@/lib/format";
import type { ProjectType, Service } from "@/lib/projects/types";
import { createProject } from "../actions";

export type ProjectPrefill = Partial<{
  lead_id: string;
  client_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  setter_name: string | null;
  notes: string | null;
}>;

export function ProjectForm({
  services,
  isAdmin,
  today,
  defaultCommissionPct,
  prefill,
}: {
  services: Service[];
  isAdmin: boolean;
  today: string;
  defaultCommissionPct: string;
  prefill: ProjectPrefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ProjectType>("proiect");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(today);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [contractValue, setContractValue] = useState<string | null>(null);
  const [commissionEnabled, setCommissionEnabled] = useState(true);
  const [pct, setPct] = useState(formatNumber(defaultCommissionPct));
  const [retainerMonthly, setRetainerMonthly] = useState<string | null>(null);
  const [retainerStart, setRetainerStart] = useState<string | null>(null);
  const [retainerEnd, setRetainerEnd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commission =
    commissionEnabled && contractValue
      ? toDecimal(contractValue)
          .times(toDecimal(pct.replace(",", ".") || 0))
          .div(100)
      : null;

  return (
    <form
      className="grid max-w-4xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const text = (name: string) => String(data.get(name) ?? "").trim() || null;
        const values = {
          lead_id: prefill.lead_id ?? null,
          client_name: text("client_name") ?? "",
          contact_name: text("contact_name"),
          contact_email: text("contact_email"),
          contact_phone: text("contact_phone"),
          website: text("website"),
          description: text("description"),
          type,
          start_date: startDate,
          deadline,
          notes: text("notes"),
        };
        const finance = isAdmin
          ? {
              contract_value: contractValue ?? "0",
              commission_enabled: commissionEnabled,
              setter_commission_pct: pct,
              setter_name: text("setter_name"),
              retainer_monthly_amount: type === "retainer" ? retainerMonthly : null,
              retainer_start_month: type === "retainer" ? retainerStart : null,
              retainer_end_month: type === "retainer" ? retainerEnd : null,
            }
          : null;
        setError(null);
        startTransition(async () => {
          const result = await createProject(values, finance, serviceIds);
          if (result.ok) {
            toast.success("Proiect creat");
            router.push(`/proiecte/${result.data}`);
          } else setError(result.error);
        });
      }}
    >
      <Section title="Client">
        <Field label="Nume client / companie *" className="sm:col-span-2">
          <Input name="client_name" required defaultValue={prefill.client_name} autoFocus={!prefill.client_name} />
        </Field>
        <Field label="Persoană de contact">
          <Input name="contact_name" defaultValue={prefill.contact_name ?? ""} />
        </Field>
        <Field label="Telefon">
          <Input name="contact_phone" defaultValue={prefill.contact_phone ?? ""} inputMode="tel" />
        </Field>
        <Field label="Email">
          <Input name="contact_email" type="email" defaultValue={prefill.contact_email ?? ""} />
        </Field>
        <Field label="Website">
          <Input name="website" defaultValue={prefill.website ?? ""} />
        </Field>
      </Section>

      <Section title="Proiect">
        <Field label="Ce s-a vândut" className="sm:col-span-2">
          <Input name="description" placeholder="ex. 20 clipuri video UGC + 10 statice" autoFocus={Boolean(prefill.client_name)} />
        </Field>
        <Field label="Tip">
          <Select value={type} onValueChange={(v) => setType(v as ProjectType)}>
            <SelectTrigger>
              <SelectValue>{type === "retainer" ? "Retainer (lunar)" : "Proiect"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proiect">Proiect</SelectItem>
              <SelectItem value="retainer">Retainer (lunar)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Servicii</Label>
          <ServicePicker
            services={services}
            value={serviceIds}
            onToggle={(id, selected) => setServiceIds((current) => (selected ? [...current, id] : current.filter((x) => x !== id)))}
          />
          <p className="text-xs text-muted-foreground">
            Fiecare serviciu vine cu pașii lui (Setări → Proiecte). Pe proiect îi bifezi pe măsură ce îi faci.
          </p>
        </div>
        <Field label="Dată început" hint="Termenele pașilor se calculează din ea (Setări → Proiecte).">
          <DateField value={startDate} onChange={setStartDate} aria-label="Dată început" />
        </Field>
        <Field label="Deadline livrare">
          <DateField value={deadline} onChange={setDeadline} aria-label="Deadline livrare" />
        </Field>
      </Section>

      {isAdmin ? (
        <Section title="Bani" description="Vizibil doar pentru tine. Tranșele și costurile le adaugi după creare, pe pagina proiectului.">
          <Field label="Valoare contract">
            <MoneyInput value={contractValue} onCommit={setContractValue} allowEmpty aria-label="Valoare contract" />
          </Field>
          <Field label="Setter (cine primește comisionul)">
            <Input name="setter_name" defaultValue={prefill.setter_name ?? ""} />
          </Field>
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-2">
              <Checkbox checked={commissionEnabled} onCheckedChange={(v) => setCommissionEnabled(v === true)} />
              Comision setter
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                disabled={!commissionEnabled}
                inputMode="decimal"
                className="w-24 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
              {commission ? <span className="text-sm text-muted-foreground">= {formatRON(commission)}</span> : null}
            </div>
          </div>
          {type === "retainer" ? (
            <>
              <Field label="Sumă lunară">
                <MoneyInput value={retainerMonthly} onCommit={setRetainerMonthly} allowEmpty aria-label="Sumă lunară" />
              </Field>
              <Field label="Perioadă: de la">
                <DateField value={retainerStart} onChange={setRetainerStart} aria-label="Retainer de la" />
              </Field>
              <Field label="până la">
                <DateField value={retainerEnd} onChange={setRetainerEnd} aria-label="Retainer până la" />
              </Field>
            </>
          ) : null}
        </Section>
      ) : null}

      <Section title="Notițe">
        <Field label="Notițe" className="sm:col-span-2">
          <Textarea name="notes" rows={4} defaultValue={prefill.notes ?? ""} />
        </Field>
      </Section>

      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Creează proiectul
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Renunță
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface grid gap-3 p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`grid content-start gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
