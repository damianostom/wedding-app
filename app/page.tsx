'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

export default function Home() {
  const supabase = supaClient()
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAuthed(!!session)
    })()
  }, [supabase])

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border bg-white shadow-sm wedding-card">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-sky-50" />
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-gradient-to-br from-rose-200/60 to-amber-100/60 blur-3xl" />
        <div className="card-pad relative">
          <span className="pill">Aplikacja weselna</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-brand-700 via-rose-500 to-amber-600 bg-clip-text text-transparent">
              Witamy na naszej stronie weselnej
            </span>
            <span className="ml-2">🎉</span>
          </h1>
          <p className="mt-3 max-w-2xl muted">
            Jedno miejsce na wszystkie informacje: galeria zdjęć i wideo, czat gości,
            plan stołów (PDF) oraz prośby o piosenki. Wejdź i poczuj klimat imprezy!
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!authed && <Link href="/login" className="btn no-underline">Zaloguj się</Link>}
            <Link href="/app" className="btn-ghost no-underline">Przejdź do panelu</Link>
          </div>
        </div>
      </section>

      {/* FEATURES – „piątka” kart z mikro-animacjami */}
      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Feature
          icon="📌"
          title="Najważniejsze informacje"
          desc="Godziny, dojazd, harmonogram i praktyczne tipy—zawsze aktualne."
          href="/app/info"
          badge="Nowe treści"
        />
        <Feature
          icon="🖼️"
          title="Galeria zdjęć"
          desc="Wrzucaj fotki, pobieraj paczki .zip, komentuj wspomnienia."
          href="/app/gallery"
          badge="Upload wielo-plikowy"
        />
        <Feature
          icon="💬"
          title="Czat gości"
          desc="Rozmowy na żywo, wyróżnianie ważnych wiadomości, szybka moderacja."
          href="/app/chat"
        />
        <Feature
          icon="🪑"
          title="Plan stołów (PDF)"
          desc="Podgląd układu + eksport do PDF i publikacja w chmurze."
          href="/app/tables"
        />
        <Feature
          icon="🎵"
          title="Prośby o piosenki"
          desc="Zgłaszaj utwory, zbieraj lajki—DJ widzi kolejkę w swoim boxie."
          href="/app/songs"
          badge="DJ box"
        />
        {/* karta z tipem */}
        <article className="card wedding-card lift reveal-up">
          <div className="card-pad">
            <h3 className="text-lg font-semibold">Pro tip</h3>
            <p className="mt-2 muted">
              Dodaj stronę do ekranu głównego telefonu — będzie działać jak mini-apka.
            </p>
          </div>
        </article>
      </section>
    </div>
  )
}

function Feature({
  icon, title, desc, href, badge,
}: { icon: string; title: string; desc: string; href: string; badge?: string }) {
  return (
    <Link href={href} className="no-underline">
      <article className="card wedding-card lift reveal-up shine">
        <div className="card-pad">
          <div className="flex items-center justify-between">
            <div className="text-2xl">{icon}</div>
            {badge && <span className="pill">{badge}</span>}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{title}</h3>
          <p className="mt-2 muted">{desc}</p>
          <div className="mt-4 inline-flex items-center text-sm font-medium text-brand-700">
            Otwórz <span className="ml-1">→</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
