// app/layout.tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'
import AuthButtons from '@/components/AuthButtons'

export const metadata: Metadata = {
  title: 'Wedding App',
  description: 'Aplikacja weselna',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen wedding-bg">
        <header className="border-b bg-white/70 backdrop-blur">
          <div className="container-app flex items-center justify-between py-4">
            <div className="font-head text-xl font-semibold">Agatka &amp; Damian</div>
            <AuthButtons />
          </div>
        </header>

        <main className="container-app my-6">
          {children}
        </main>
      </body>
    </html>
  )
}
