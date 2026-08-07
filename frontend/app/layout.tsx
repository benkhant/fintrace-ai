import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fintrace AI",
  description: "AI-powered personal finance dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-8 py-4 flex gap-6">
          <a href="/" className="text-sm font-medium text-gray-700 hover:text-blue-600">
            Dashboard
          </a>
          <a href="/ask" className="text-sm font-medium text-gray-700 hover:text-blue-600">
            Ask AI
          </a>
        </nav>
        {children}
        </body>
    </html>
  );
}
