# Ecomlab CRM

CRM intern pentru Ecomlab: lead-uri, proiecte și producție, actori, calendar filmări, cashflow, remindere.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind 4 · componente în stil shadcn/ui (Radix) · Supabase (Postgres, Auth, RLS) · Vercel.

Documente:
- [`docs/PROPUNERE.md`](docs/PROPUNERE.md): schema bazei de date și structura paginilor (cu deciziile confirmate).

## Etape

| Etapă | Conținut | Stare |
|---|---|---|
| 1 | Setup, autentificare, layout, temă light/dark, Setări de bază | ✅ |
| 2 | Lead-uri: tabel, taburi pe status, follow-up automat, import CSV/Excel | ✅ |
| 3 | Proiecte, etape, tranșe, costuri, comision, actori, calendar | ✅ |
| 4 | Cashflow, plăți de făcut, taxe pe lună, forecast 12 luni | ✅ |
| 5 | Dashboard, remindere in-app, email zilnic, push | ✅ |
| 6 | Deploy Vercel + ghid complet Supabase/Resend | ⏳ |

---

## Setup (Etapa 1)

### 1. Proiect Supabase

1. Creează un cont pe [supabase.com](https://supabase.com) → **New project**. Regiune: **Central EU (Frankfurt)**. Salvează parola bazei de date.
2. **SQL Editor → New query**: lipește conținutul fișierului `supabase/migrations/20261009000001_core.sql` și apasă **Run**.
   > Rulează migrațiile din `supabase/migrations/` **în ordine**, câte una, pe măsură ce apar în etapele următoare.
3. **Authentication → Sign In / Providers → Email**: lasă activ **Email**. Dezactivează **Allow new users to sign up** (conturile le creezi tu, nu se poate înregistra oricine).
4. **Authentication → Users → Add user → Create new user**: emailul și parola ta, bifează **Auto Confirm User**.
   **Primul cont creat devine automat admin.**
5. **Project Settings → API Keys**: copiază **Project URL**, cheia **publishable** și cheia **secret** (service role).

### Actualizare la o etapă nouă

Când apare o migrație nouă în `supabase/migrations/`, rulează doar fișierul nou în **SQL Editor** (în ordinea numelor):

| Fișier | Etapa |
|---|---|
| `20261009000001_core.sql` | 1 |
| `20261010000002_leads.sql` | 2 |
| `20261011000003_projects.sql` | 3 |
| `20261012000004_finance.sql` | 4 |
| `20261013000005_leads_order.sql` | ordinea taburilor la Lead-uri |

### Remindere și notificări (Etapa 5)

Dashboard-ul și badge-urile din sidebar merg fără nicio configurare. Pentru **email** și **push** adaugi variabile de mediu în **Vercel → Settings → Environment Variables**, apoi faci **Redeploy**.

1. **Adresa aplicației**: `NEXT_PUBLIC_SITE_URL` = linkul de la Vercel, ex. `https://ecomlabdash.vercel.app` (pentru linkurile din email).
2. **Secretul pentru cron**: `CRON_SECRET` = un șir lung, aleator (minim 32 de caractere). Vercel îl trimite automat la cronul zilnic.
3. **Email (Resend)**:
   - cont pe [resend.com](https://resend.com) → **API Keys → Create API Key** → `RESEND_API_KEY`;
   - `EMAIL_FROM`: fără domeniu verificat, folosește `Ecomlab CRM <onboarding@resend.dev>` (merge doar către emailul cu care ți-ai făcut contul Resend). Pentru alte adrese: **Domains → Add Domain**, adaugi înregistrările DNS și apoi ex. `Ecomlab CRM <crm@ecomlab.ro>`.
4. **Push**: în aplicație, **Setări → Notificări → Generează chei VAPID**, copiezi cele 3 valori (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) în Vercel, redeploy, apoi pe telefon: instalezi aplicația pe ecranul principal și apeși **Activează pe acest dispozitiv**.
5. **Ora exactă (recomandat)**: Vercel gratuit rulează cronul o dată pe zi (`vercel.json`, 05:00 UTC = 07:00/08:00 în România). Ca emailul să plece la ora din Setări și push-ul să vină la ora fiecărui follow-up, deschide `supabase/cron-setup.sql`, înlocuiește adresa și secretul și rulează-l în **Supabase → SQL Editor**. Supabase va apela aplicația la fiecare 15 minute.

Verificare: **Setări → Notificări → Trimite-mi acum emailul** și **Trimite un test** (push).

### 2. Rulare locală

Ai nevoie de Node.js 20+.

```bash
npm install
cp .env.example .env.local   # completează cu valorile din Supabase
npm run dev
```

Deschide http://localhost:3000 și intră cu contul creat la pasul 4.

### Comenzi utile

```bash
npm run dev        # server de dezvoltare
npm run build      # build de producție
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # teste (calculul lunar: profit, impozite, sold)
```

## Structură

```
src/
  app/
    (app)/            paginile aplicației (după login): dashboard, lead-uri, proiecte, …
      setari/         Setări: general, lead-uri, proiecte, financiar, notificări, utilizatori
    login/            autentificare
    auth/signout/     deconectare
  components/
    ui/               componente de bază (button, input, dialog, select, …)
    layout/           sidebar, header, meniu mobil, toggle temă
  lib/
    supabase/         clienți Supabase (browser, server, proxy)
    format.ts         formatare RON, date zz.ll.aaaa, fus orar Europe/Bucharest
  proxy.ts            protejează rutele: fără sesiune → /login
supabase/migrations/  schema bazei de date (SQL)
```

## Convenții

- **Bani:** `numeric(14,2)` în baza de date. În aplicație sumele rămân string/`Decimal` (`decimal.js`), niciodată `float`.
- **Date:** coloanele `date` sunt „aaaa-ll-zz”; în interfață apar ca `zz.ll.aaaa`. „Azi” se calculează mereu în `Europe/Bucharest` (`today_ro()` în SQL, `todayISO()` în TS).
- **Roluri:** `admin`, `setter`, `productie`, impuse prin Row Level Security în Postgres, nu doar în interfață.
