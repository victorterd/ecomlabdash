import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Autentificare" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="h-8" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">Autentificare</h1>
          <p className="mb-5 text-sm text-muted-foreground">Intră în contul tău Ecomlab CRM.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </div>
    </div>
  );
}
