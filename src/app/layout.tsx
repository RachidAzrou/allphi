import type { Metadata, Viewport } from "next";
import { Montserrat, Karla } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fleet Companion",
  description: "Jouw persoonlijke fleet assistent — snel antwoord op al je wagenvragen.",
  manifest: "/manifest.json",
  applicationName: "Fleet Companion",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icons/app-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/app-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fleet Companion",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2799D7" },
    { media: "(prefers-color-scheme: dark)", color: "#163247" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<Record<string, never>>;
}>) {
  await params;
  return (
    <html
      lang="nl"
      className={`${montserrat.variable} ${karla.variable} h-full overflow-x-hidden`}
    >
      <body className="flex min-h-dvh flex-col antialiased [-webkit-tap-highlight-color:transparent] selection:bg-[#2799D7]/20 selection:text-[#163247]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
