import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

// IBM Plex Sans + Plex Mono per design-direction-2026-05-27.md. Two families
// from one type system: the sans carries body/UI; the mono is reserved for
// digit-heavy contexts (rent figures, IDs, timestamps). Geist removed to drop
// the AI-default visual signal. Variable names kept as --font-geist-* so
// existing globals.css and shadcn primitive class references continue to work
// without churn.
const plexSans = IBM_Plex_Sans({
  variable: "--font-geist-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlexOps AI Demo Suite",
  description:
    "AI workflow demos for a flex industrial operator (fictional client).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="font-sans antialiased">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="ml-[260px] flex-1 flex flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto bg-background">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
