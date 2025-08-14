'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { href: "/app/info", label: "Info" },
  { href: "/app/gallery", label: "Galeria" },
  { href: "/app/chat", label: "Czat" },
  { href: "/app/guests", label: "Goście" },
  { href: "/app/tables", label: "Stoły/PDF" },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="space-y-5">
      <nav className="card">
        <div className="card-pad nav">
          {items.map(i => (
            <Link
              key={i.href}
              href={i.href}
              className={`nav-link no-underline ${path.startsWith(i.href) ? "nav-link-active" : ""}`}
            >
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="card">
        <div className="card-pad prose prose-slate max-w-none">
          {children}
        </div>
      </div>
    </div>
  )
}
