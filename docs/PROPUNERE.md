# Ecomlab CRM — Propunere schemă bază de date și structură pagini

> Etapa 0, confirmată. Deciziile sunt în §7.

---

## 1. Principii de arhitectură

| Decizie | Alegere | De ce |
|---|---|---|
| Sume de bani | `numeric(14,2)` peste tot, cu `check (amount >= 0)` | fără erori de float; semnul îl dă `type` (încasare/cheltuială) |
| Date calendaristice | `date` (fără oră) pentru scadențe, follow-up, etape; `timestamptz` pentru log-uri | „azi” se calculează mereu în `Europe/Bucharest` (funcție SQL `today_ro()`) |
| O singură sursă de adevăr pentru bani | tabela **`transactions`** | tranșele de pe proiect, costurile de proiect, comisionul, retainer-ul și tranzacțiile manuale sunt toate rânduri în `transactions` cu `project_id` + `kind`. Nu există sincronizare între tabele → cashflow-ul nu poate „rămâne în urmă” față de proiect |
| Financiarul separat de restul | valoarea contractului și comisionul stau în `project_finance`, nu în `projects` | RLS e la nivel de rând; separând tabelele, rolul `productie` vede proiectul dar nu vede niciun leu |
| Liste configurabile | statusuri, surse, stadii, tipuri cost, categorii = tabele, nu enum-uri | le editezi din Setări. Logica nu depinde de nume, ci de flag-uri (`is_follow_up`, `is_won`) → poți redenumi „Follow up” fără să strici automatizarea |
| Date de test | coloană `is_seed boolean` pe tabelele principale | buton „Șterge datele de test” din Setări = `delete … where is_seed` |
| Roluri | `admin`, `setter`, `productie` în `profiles.role`; funcție `current_role()` (security definer) folosită în toate politicile RLS | |

---

## 2. Schema bazei de date

Convenții: toate tabelele au `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, iar cele editabile au și `updated_at` (trigger automat). Le omit mai jos ca să fie lizibil.

### 2.1 Utilizatori, setări, notificări

**`profiles`** — 1:1 cu `auth.users`
| coloană | tip | note |
|---|---|---|
| id | uuid pk → auth.users | |
| full_name | text | |
| role | enum `user_role` (`admin`,`setter`,`productie`) | primul user creat = admin |
| theme | text (`light`/`dark`/`system`) | default `light` |
| email_notifications_to | text | default = email-ul de login |

**`app_settings`** — un singur rând (setări generale, citibile de toți)
| coloană | tip | default |
|---|---|---|
| follow_up_days | int | 7 |
| follow_up_default_time | time | 10:00 (ora reminderului push dacă lead-ul n-are oră) |
| daily_email_time | time | 08:00 |
| timezone | text | Europe/Bucharest |

**`finance_settings`** — un singur rând, **doar admin**
| coloană | tip | default |
|---|---|---|
| setter_commission_pct | numeric(5,2) | 15.00 |
| profit_tax_pct | numeric(5,2) | 16.00 |
| dividend_tax_pct | numeric(5,2) | 16.00 |
| opening_balance | numeric(14,2) | 0 |
| opening_balance_date | date | data pornirii |

**`notification_prefs`** — per user: `user_id`, `email_daily bool`, `push_enabled bool`, `notify_followups`, `notify_installments`, `notify_payments`, `notify_shootings`, `notify_stage_deadlines`, `notify_followup_at_time` (toate bool, default true).

**`push_subscriptions`** — `user_id`, `endpoint text unique`, `p256dh`, `auth`, `user_agent`.

**`notification_log`** — `user_id`, `channel` (`email`/`push`), `kind`, `ref_table`, `ref_id`, `for_date date`, `sent_at`. Unic pe (`user_id`,`channel`,`kind`,`ref_id`,`for_date`) → nu trimite de două ori același reminder.

### 2.2 Lead-uri

**`lead_statuses`** (configurabil)
| coloană | tip | note |
|---|---|---|
| name | text unique | Recepție, Nu a răspuns, Follow up, Trimis mail, Nu vrea, Meet setat, Câștigat |
| color | text | hex |
| sort_order | int | ordinea taburilor |
| is_default | bool | statusul pentru lead nou (Recepție) |
| is_follow_up | bool | declanșează data automată de follow-up |
| is_won | bool | afișează butonul „Creează proiect” |
| is_closed | bool | Nu vrea / Câștigat — nu mai apar în remindere |

**`lead_sources`** — `name`, `sort_order`, `active`. Implicit: Cold call, TikTok form, Recomandare, Altele.

**`leads`**
| coloană | tip | note |
|---|---|---|
| company_name | text not null | |
| website | text | |
| owner_name | text | persoana de contact |
| email | text | |
| phone1, phone2 | text | |
| status_id | uuid → lead_statuses | |
| source_id | uuid → lead_sources | |
| called_by | text | text liber acum |
| called_by_user_id | uuid → profiles, null | pentru când vine setter-ul |
| follow_up_date | date | |
| follow_up_time | time, null | opțional, pt. push la oră |
| notes | text | câmpul mare „Informații” |
| website_norm, email_norm, phone1_norm, phone2_norm | text **generated** | lowercase, fără `https://www.` / `/` final; telefoane doar cifre, normalizate la `07…` (fără +40/0040) |
| created_by | uuid → profiles | |
| is_seed | bool | |

Indexuri: pe `status_id`, `follow_up_date`, pe fiecare coloană `_norm`, plus `pg_trgm` pe `company_name` pentru căutare.

**`lead_status_history`** — `lead_id`, `from_status_id`, `to_status_id`, `changed_by`, `changed_at`. Populat automat de trigger.

**Trigger `leads_before_update`:**
1. dacă `status_id` se schimbă spre un status cu `is_follow_up = true` **și** `follow_up_date` nu a fost modificat explicit în același update → `follow_up_date = today_ro() + app_settings.follow_up_days`;
2. inserează rând în `lead_status_history` (și la insert, cu `from = null`).

**Funcție `find_lead_duplicates(website, email, phones[])`** — întoarce lead-urile care se potrivesc pe oricare cheie normalizată. Folosită la adăugare manuală (avertisment, poți forța) și la import (sărite și raportate).

**`lead_imports`** — `file_name`, `total_rows`, `imported`, `skipped_duplicates`, `errors jsonb`, `mapping jsonb` (ca să reutilizez maparea data viitoare), `created_by`.

### 2.3 Proiecte

**`project_stages`** (seed, editabil din Setări): Semnat → Produs primit → Scripturi → Revizie scripturi → Casting → Filmare → Editare → Revizie edit → Livrat. Coloane: `name`, `sort_order`, `color`, `is_final`, `default_offset_days` (opțional: sugerează termenele etapelor la crearea proiectului).

**`projects`** — vizibil pentru `admin` și `productie`
| coloană | tip | note |
|---|---|---|
| lead_id | uuid → leads, null | dacă vine din lead |
| client_name | text not null | |
| contact_name, contact_email, contact_phone, website | text | precompletate din lead |
| description | text | „20 clipuri video” |
| type | enum `project_type` (`proiect`,`retainer`) | |
| start_date, deadline | date | |
| current_stage_id | uuid → project_stages | |
| board_position | numeric | ordinea în coloana Kanban |
| notes | text | |
| archived | bool | |
| is_seed | bool | |

**`project_finance`** — 1:1 cu proiectul, **doar admin**
| coloană | tip | note |
|---|---|---|
| project_id | uuid pk → projects | |
| contract_value | numeric(14,2) | la retainer = calculat (lunar × nr. luni) dar editabil |
| setter_commission_pct | numeric(5,2) | precompletat din `finance_settings` |
| setter_name / setter_user_id | text / uuid | cine primește comisionul |
| commission_enabled | bool | default true |
| retainer_monthly_amount | numeric(14,2) null | |
| retainer_start_month, retainer_end_month | date null | prima zi a lunii |
| retainer_payment_day | int null | ziua din lună a încasării |

**`project_stage_deadlines`** — `project_id`, `stage_id`, `planned_date`, `completed_date`; unic (`project_id`,`stage_id`). La mutarea proiectului pe un stadiu nou (Kanban) se completează automat `completed_date = azi` pentru etapa părăsită (editabil).

Reguli de afișare (calculate, nu stocate):
- **roșu**: există etapă cu `planned_date < azi` și `completed_date is null`;
- **galben**: `deadline` în următoarele 7 zile (pragul poate fi setare) și proiectul nu e Livrat.

**`cost_types`** — `name`, `sort_order`, `default_category_id → expense_categories`, `is_commission bool`. Seed: Editor, Cameraman, Actor, Agent vânzări (comision, `is_commission = true`), Scenarist. Toate mapate implicit pe categoria „Echipă producție”.

### 2.4 Actori, filmări

**`actors`** — `name`, `phone`, `email`, `instagram`, `rate numeric(14,2)`, `rate_unit` (`clip`/`zi`), `notes`, `rating smallint 1–5`, `active`, `is_seed`.
> `rate` e informație financiară, dar e nevoie ca `productie` să-l vadă când face casting? → vezi întrebarea 5.

**`project_actors`** — `project_id`, `actor_id`, `role_notes`, `agreed_fee numeric null`; unic (`project_id`,`actor_id`). Istoricul actorului = proiectele din tabela asta. Buton „Adaugă cost actor” → creează tranzacție de cost cu `actor_id`.

**`shoots`** (zile de filmare) — `project_id`, `shoot_date date`, `start_time time`, `end_time time null`, `location`, `notes`.
**`shoot_actors`** — `shoot_id`, `actor_id`.

### 2.5 Financiar (doar admin)

**`expense_categories`** — `name unique`, `sort_order`, `active`. Seed: Echipă producție, Ads (TikTok/Meta), Soft-uri, Contabilitate / taxe. Se pot adăuga direct din formularul de cheltuială.

**`transactions`** — inima cashflow-ului
| coloană | tip | note |
|---|---|---|
| type | enum `tx_type` (`income`,`expense`) | Încasare / Cheltuială |
| amount | numeric(14,2) check > 0 | |
| status | enum `tx_status` (`planned`,`realized`) | Planificat / Realizat (= Încasat / Plătit pe proiect) |
| due_date | date | data planificată / scadentă |
| realized_date | date null | data efectivă; obligatorie când `status = realized` |
| category_id | uuid → expense_categories | obligatoriu la cheltuieli |
| scope | enum (`business`,`personal`) | doar cheltuieli; default business |
| project_id | uuid → projects, null | |
| kind | enum: `manual`, `installment` (tranșă), `project_cost`, `commission`, `retainer`, `recurring` | de unde vine rândul |
| cost_type_id | uuid → cost_types, null | la costuri de proiect |
| person | text | editor / cameraman / etc. |
| actor_id | uuid → actors, null | |
| recurring_rule_id | uuid → recurring_expenses, null | |
| period_month | date null | luna generată (retainer/recurent) → unic cu regula, ca generarea să fie idempotentă |
| description | text | |
| is_seed | bool | |

**Data efectivă a unei tranzacții** = `coalesce(realized_date, due_date)` → e data folosită la încadrarea pe lună.

Comportamente automate:
- **Comision setter**: trigger pe `project_finance` creează/actualizează o tranzacție `kind = commission`, `amount = contract_value × pct / 100`, cât timp e `planned`. Dacă ai marcat-o plătită sau ai editat suma manual (flag `manual_override`), nu o mai rescrie.
- **Retainer**: fără generare automată (decizia 7). Tranșele lunare se adaugă manual pe proiect.
- **Recurente**: tabela **`recurring_expenses`** (`description`, `amount`, `category_id`, `scope`, `day_of_month`, `start_month`, `end_month null`, `active`). Jobul zilnic menține generate tranzacțiile planificate pentru următoarele 12 luni (idempotent).

**`forecast_entries`** — `month date` (prima zi), `type` (`income`/`expense`), `category_id null` (la venituri null), `amount`; unic (`month`,`type`,`category_id`).

**Calcul lunar** — funcție SQL `monthly_pnl(from_month, to_month, include_planned bool)` care întoarce pe lună: venituri, cheltuieli business, cheltuieli personale. Taxele se calculează în aplicație (TypeScript, cu `decimal.js`, nu `number`) după formulele tale:

```
Profit general      = Venituri − Ch. business
Profit contabil     = Venituri − Ch. business − Ch. personale
Impozit profit      = max(0, Profit contabil) × profit_tax_pct
Profit după impozit = Profit contabil − Impozit profit
Impozit dividende   = max(0, Profit după impozit) × dividend_tax_pct
Net disponibil      = Profit după impozit − Impozit dividende
Sold final lună     = sold pornire + Σ(încasări − cheltuieli) de la data pornirii până la final de lună
```
Două variante paralele: **Realizat** și **Realizat + Planificat**, plus total anual cumulat.

### 2.6 RLS — rezumat

| tabel | admin | setter | productie |
|---|---|---|---|
| profiles | tot | doar propriul | doar propriul |
| app_settings, lead_statuses, lead_sources, project_stages | citire + scriere | citire | citire |
| finance_settings, project_finance, transactions, expense_categories, recurring_expenses, forecast_entries, cost_types | tot | — | — |
| leads, lead_status_history, lead_imports | tot | tot (ulterior: doar ale lui, dacă vrei) | — (doar lead-ul legat de un proiect, read-only — de confirmat) |
| projects, project_stage_deadlines, project_actors, actors, shoots, shoot_actors | tot | — | tot |
| notification_prefs, push_subscriptions, notification_log | tot | doar ale lui | doar ale lui |

Cron-ul folosește `service_role` (ocolește RLS) doar pe server.

---

## 3. Structura de pagini (Next.js App Router)

```
/login                         autentificare email + parolă
/                              Dashboard: De făcut azi · Remindere · Bani luna asta* · Proiecte și termene
/leaduri                       tabel + taburi pe status (cu număr): ?status=<id>
  ├─ panou lateral (drawer)    fișă lead: câmpuri, istoric status, „Creează proiect” dacă e Câștigat
  └─ /leaduri/import           pas 1 upload → pas 2 mapare coloane → pas 3 previzualizare + duplicate → pas 4 raport
/proiecte                      toggle Kanban / Tabel, filtre (activ, întârziat, tip)
  ├─ /proiecte/nou             (?lead=<id> precompletează)
  └─ /proiecte/[id]            taburi: Prezentare · Etape & termene · Încasări* · Costuri* · Actori · Filmări · Notițe
/actori                        listă + fișă actor (istoric proiecte, rating)
/calendar                      lună / săptămână; filtre: filmări, deadline-uri, etape, follow-up-uri
/financiar*                    tabel pe luni (Realizat | Realizat+Planificat), grafice, sold
  ├─ /financiar/tranzactii*    listă + adăugare încasare/cheltuială, filtre
  ├─ /financiar/categorii*     defalcare cheltuieli pe categorii × luni
  ├─ /financiar/forecast*      grilă 12 luni: Forecast vs Planificat vs Realizat + sold proiectat
  └─ /financiar/recurente*     cheltuieli recurente lunare
  └─ /financiar/plati*         plăți de făcut: costuri de proiect și comisioane planificate
/setari                        Lead-uri · Proiecte · Financiar* · Notificări · Aspect · Utilizatori (pregătit) · Date de test
/api/cron/tick                 apelat periodic (vezi §4)
/api/push/subscribe            salvare abonament Web Push
```
`*` = doar admin (ascuns din meniu + protejat în middleware + RLS).

Header: căutare globală (lead/proiect), toggle light/dark, meniu cont. Sidebar: Dashboard, Lead-uri, Proiecte, Calendar, Actori, Financiar, Setări — cu badge de remindere restante. Pe telefon sidebar-ul devine meniu jos/drawer.

---

## 4. Remindere — o problemă tehnică de semnalat

**Vercel Cron pe planul gratuit (Hobby) rulează maxim o dată pe zi și fără precizie de minut.** Asta nu ajunge pentru „ora emailului configurabilă” și „push la ora follow-up-ului”.

Propunere (tot gratuit): **Supabase `pg_cron` + `pg_net`** apelează `/api/cron/tick` la fiecare 15 minute (cu un secret în header). La fiecare apel:
1. dacă ora României ≥ `daily_email_time` și emailul de azi nu s-a trimis → trimite emailul zilnic (Resend) + push-ul rezumat;
2. trimite push pentru follow-up-urile care au ora în fereastra curentă;
3. o dată pe zi: generează tranzacțiile recurente / retainer pentru următoarele 12 luni.

Vercel Cron rămâne configurat o dată pe zi ca plasă de siguranță. `notification_log` previne dublurile.

---

## 5. Librării

shadcn/ui + Tailwind · `@tanstack/react-table` (tabel dens, editare inline) · `@dnd-kit` (Kanban) · `papaparse` + `xlsx` (SheetJS) pentru import · `recharts` (grafice) · `react-hook-form` + `zod` · `date-fns` + `@date-fns/tz` · `decimal.js` (calcule bani) · `next-themes` · `@serwist/next` (PWA/service worker) · `web-push` · `resend` + `react-email` · `@supabase/ssr`.

Migrațiile SQL stau în `supabase/migrations/`, seed-ul în `supabase/seed.sql` + buton din Setări.

---

## 6. Design

Culorile vin din logo: verde **#1CDB10** (accent/primar) și negru **#111111** (text). Fonturi: Outfit pentru titluri (geometric, apropiat de logo) și Inter pentru restul interfeței (lizibil în tabele dense). Toate culorile sunt tokeni în `src/app/globals.css`.

---

## 7. Decizii confirmate (09.10.2026)

1. **Design**: logo primit; culorile de mai sus.
2. **Ora follow-up-ului**: implicit 10:00 (din Setări), editabilă pe fiecare lead.
3. **Stadiile proiectului**: configurabile din Setări.
4. **Cashflow**: o tranzacție planificată stă în luna scadenței; după ce e realizată, trece în luna datei efective.
5. **Roluri**: deocamdată nu se folosesc (doar uz intern). Arhitectura (rol pe profil + RLS) rămâne pregătită.
6. **Comision setter**: planificat la data primei tranșe. În Financiar există o pagină **Plăți de făcut** (costuri și comisioane planificate).
7. **Retainer**: fără generare automată. Tipul „Retainer” rămâne pe proiect, iar detaliile (tranșe lunare etc.) le completezi manual când se vinde unul.
8. **Cheltuieli personale**: se scad în „Profit contabil” exact după formulă. Sunt cheltuieli pe firmă din afara business-ului, iar calculul arată cât ai de plătit.
9. **Setter**: vizibilitatea lead-urilor se decide pe viitor; acum vede totul doar adminul.
