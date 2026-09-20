import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { routing } from "@/i18n/routing";
import { Geist, Geist_Mono } from "next/font/google";
import { ChatWidget } from "@/components/ChatWidget";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PackagePro — Dynamic Tour Packages",
  description:
    "Swap stops, reprice live, and get an explained itinerary — powered by the PS-04 travel dataset.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextThemesProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          enableColorScheme
          disableTransitionOnChange
        >
          <NextIntlClientProvider>
            {children}
            <ChatWidget />
          </NextIntlClientProvider>
        </NextThemesProvider>
      </body>
    </html>
  );
}
