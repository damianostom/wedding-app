'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

// usunięto: { href: '/app/guests', label: 'Goście' }
const baseItems = [
  { href: '/app/info', label: 'Info' },
  { href: '/app/gallery', label: 'Galeria' },
  { href: '/app/videos', label: 'Wideo' },
  { href: '/app/chat', label: 'Czat' },
  { href: '/app/tables', label: 'Stoły/PDF' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    ;(async () => {
      const supabase = supaClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
      setIsOrganizer(data?.role === 'organizer')
    })()
  }, [])

  const items = isOrganizer ? [...baseItems, { href: '/app/admin/guests', label: 'Admin' }] : baseItems

  return (
    <div className="space-y-5">
      <nav className="card wedding-card">
        <div className="card-pad flex flex-wrap gap-2">
          {items.map(i => (
            <Link
              key={i.href}
              href={i.href}
              className={`nav-link no-underline ${path.startsWith(i.href) ? 'nav-link-active' : ''}`}
            >
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="card wedding-card">
        <div className="card-pad prose prose-slate max-w-none">{children}</div>
      </div>
    </div>
  )
}
