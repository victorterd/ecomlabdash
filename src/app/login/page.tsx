import type { Metadata } from "next";
import { CalendarCheck2Icon, ClapperboardIcon, PhoneCallIcon, WalletIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Autentificare" };

const FEATURES = [
  { icon: PhoneCallIcon, text: "Lead-uri și follow-up-uri care nu se mai pierd" },
  { icon: ClapperboardIcon, text: "Proiecte, pași și filmări sub control" },
  { icon: WalletIcon, text: "Cashflow, profit și taxe calculate pe lună" },
  { icon: CalendarCheck2Icon, text: "Remindere pe email și pe telefon" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0b0d0b] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-[#1cdb10] opacity-[0.16] blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 bottom-[-180px] size-[420px] rounded-full bg-[#1cdb10] opacity-[0.10] blur-[110px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }}
        />
        <Logo onDark className="relative h-7" />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-[40px] leading-[1.05] font-semibold tracking-tight">
            Tot ce ține de agenție, <span className="text-[#1cdb10]">într-un singur loc.</span>
          </h2>
          <ul className="mt-8 grid gap-3.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-[15px] text-white/75">
                <span className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <f.icon className="size-4 text-[#1cdb10]" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/40">© {new Date().getFullYear()} Ecomlab</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px] animate-fade-up">
          <Logo className="mb-10 h-7 lg:hidden" />
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Bine ai revenit</h1>
          <p className="mt-1.5 mb-8 text-sm text-muted-foreground">Intră în contul tău Ecomlab CRM.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </main>
    </div>
  );
}
