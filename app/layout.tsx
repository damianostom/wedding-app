// app/layout.tsx  ← ROOT LAYOUT (SERVER COMPONENT)
import './globals.css'
import AuthButtons from '@/components/AuthButtons'

export const metadata = {
  title: 'Agata & Damian – Wedding',
  description: 'Aplikacja weselna',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen wedding-bg">
        <div className="container-app py-6">
          <header className="mb-6 flex items-center justify-between">
            <a href="/" className="text-xl font-bold no-underline">Agata &amp; Damian</a>
            <AuthButtons />
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
