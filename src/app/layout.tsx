import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "Ecomlab CRM", template: "%s · Ecomlab CRM" },
  description: "CRM, proiecte și cashflow pentru Ecomlab",
  applicationName: "Ecomlab CRM",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/brand/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Ecomlab", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
