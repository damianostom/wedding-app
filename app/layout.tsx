// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import AuthButtons from '@/components/AuthButtons'
import { Playfair_Display, Great_Vibes } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin-ext'], variable: '--font-head' })
const greatvibes = Great_Vibes({ subsets: ['latin-ext'], weight: '400', variable: '--font-script' })

export const metadata: Metadata = {
  title: 'Wesele Agaty i Damiana',
  description: 'Aplikacja weselna – Agata i Damian',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${playfair.variable} ${greatvibes.variable}`}>
      <body className="min-h-screen text-slate-900 wedding-bg">
        <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
            <a href="/" className="flex items-center gap-3 no-underline">
              <span className="inline-block h-8 w-8 rounded-full bg-[var(--brand-600)] shadow-inner" />
              <div className="leading-tight">
                <div className="font-script text-2xl text-[var(--brand-700)]">Agata ♥ Damian</div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Wesele</div>
              </div>
            </a>
            <AuthButtons />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-slate-500">
          <div className="font-script text-xl text-[var(--brand-700)]">Dziękujemy, że jesteś z nami!</div>
          © {new Date().getFullYear()} Agata &amp; Damian
        </footer>
      </body>
    </html>
  )
}
