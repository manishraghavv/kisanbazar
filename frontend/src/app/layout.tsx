import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kisaan Bazaar — Multi-Vendor Agri-Commerce",
  description:
    "Empowering rural India with digital agri-commerce — buy, sell, and manage credit all in one place.",
};

/** Inline script to apply stored/OS-preferred theme BEFORE React hydrates to prevent flash */
const themeScript = `(function(){try{var e=localStorage.getItem("kb-theme");if(e==="dark"||e==="light"){if(e==="dark")document.documentElement.classList.add("dark");return}var m=window.matchMedia("(prefers-color-scheme: dark)");if(m.matches)document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
