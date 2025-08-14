// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import AuthButtons from '@/components/AuthButtons'

export const metadata: Metadata = {
  title: 'Wesele Agaty i Damiana',
  description: 'Aplikacja weselna – Agatki i Damiana',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <a href="/" className="flex items-center gap-2 font-semibold no-underline">
              <span className="inline-block h-5 w-5 rounded-md bg-violet-600" />
              <span>Wesele</span>
            </a>
            <AuthButtons />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Aplikacja Weselna • Agata i Damian Tomczyk
        </footer>
      </body>
    </html>
  )
}
