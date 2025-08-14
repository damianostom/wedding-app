import "./globals.css"
import Link from "next/link"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Aplikacja Weselna",
  description: "Goście, galeria, czat i plan stołów (PDF)",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={inter.className}>
      <body>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="container-app h-14 flex items-center justify-between">
            <Link href="/" className="no-underline flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-brand-500 to-indigo-700" />
              <span className="text-base font-semibold tracking-tight">Wesele</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link className="btn-ghost no-underline" href="/login">Zaloguj</Link>
              <Link className="btn no-underline" href="/app">Panel</Link>
            </nav>
          </div>
        </header>

        <main className="container-app py-10 md:py-12">{children}</main>

        <footer className="mt-16 border-t border-slate-200">
          <div className="container-app py-6 text-sm text-slate-500">
            © {new Date().getFullYear()} Aplikacja Weselna • Supabase + Next.js
          </div>
        </footer>
      </body>
    </html>
  )
}
