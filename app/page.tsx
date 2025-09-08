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
  }, [])

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="card overflow-hidden">
        <div className="card-pad relative">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 to-sky-50" />
          <span className="pill">Aplikacja weselna</span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Witamy na naszej stronie weselnej 🎉 Agatka i Damian
          </h1>
          <p className="mt-3 max-w-2xl muted">
            Zaloguj się, aby zobaczyć najważniejsze informacje, galerię zdjęć, czat gości oraz plan stołów w PDF.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!authed && <Link href="/login" className="btn no-underline">Zaloguj się</Link>}
            <Link href="/app" className="btn-ghost no-underline">Przejdź do panelu</Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-5 md:grid-cols-2">
        <article className="card card-pad">
          <h3 className="text-lg font-semibold">Najważniejsze informacje</h3>
          <p className="mt-2 muted">Godziny, lokalizacja, dojazd i istotne punkty. Organizer edytuje treść na bieżąco.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/info">Otwórz informacje o naszym dniu</Link>
        </article>
        <article className="card card-pad">
          <h3 className="text-lg font-semibold">Galeria zdjęć</h3>
          <p className="mt-2 muted">Goście wrzucają zdjęcia, a wszyscy mogą je oglądać i pobierać. Pliki zapisane w chmurze.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/gallery">Otwórz GALERIE!!</Link>
        </article>
        <article className="card card-pad">
          <h3 className="text-lg font-semibold">Czat</h3>
          <p className="mt-2 muted">Rozmowy w czasie rzeczywistym.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/chat">Otwórz czat</Link>
        </article>
        <article className="card card-pad">
          <h3 className="text-lg font-semibold">Plan stołów (PDF)</h3>
          <p className="mt-2 muted">Rozmieszczenie gości i eksport do PDF. Plik zapiszesz w chmurze.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/tables">Otwórz rozkład stołów</Link>
        </article>
        <article className="card card-pad">
          <h3 className="text-lg font-semibold">Prośby o piosenki</h3>
          <p className="mt-2 muted">Zapropnuj utwór i głosuj na propozycje innych.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/songs">
            Otwórz „Piosenki”
          </Link>
        </article>
      </section>
    </div>
  )
}
