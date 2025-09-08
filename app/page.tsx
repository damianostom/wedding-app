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
    <div className="space-y-12">
      {/* HERO */}
      <section className="card overflow-hidden wedding-card relative">
        {/* tło/akcenty */}
        <div
          className="absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(1200px 500px at 80% -150px, rgba(254,231,240,0.8), transparent),' +
              'radial-gradient(900px 400px at 10% 0%, rgba(199,146,125,0.18), transparent),' +
              'radial-gradient(700px 500px at 100% 80%, rgba(199,146,125,0.12), transparent)'
          }}
        />
        {/* płyta winylowa */}
        <div className="hidden md:block absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-gradient-to-br from-white to-rose-50 border border-rose-100 shadow-2xl spin-slow">
          <div className="absolute inset-6 rounded-full border-4 border-rose-100" />
          <div className="absolute inset-24 rounded-full bg-[rgb(var(--brand-600))]" />
          <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow" />
        </div>

        <div className="card-pad relative">
          <span className="pill">Let’s party!</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-gradient">
            Zabawa zaczyna się tutaj
          </h1>
          <p className="mt-4 max-w-2xl text-base md:text-lg muted">
            Zgarnij wszystkie info, wrzuć fotki, dogadaj się na czacie i wybierz hity na parkiet.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {!authed && (
              <Link href="/login" className="btn btn-gradient no-underline">
                Dołącz do zabawy
              </Link>
            )}
            <Link href="/app" className="btn-ghost no-underline">
              Przejdź do panelu
            </Link>
          </div>

          {/* „iskierki” */}
          <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-white/50 blur-2xl float-slow" aria-hidden />
          <div className="absolute left-28 -top-6 h-16 w-16 rounded-full bg-rose-200/60 blur-xl float-slow delay-300" aria-hidden />
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <article className="card card-pad hover:lift">
          <h3 className="text-lg font-semibold">Najważniejsze informacje</h3>
          <p className="mt-2 muted">Co? Gdzie? Kiedy? Wszystko w pigułce, bez przekopywania wiadomości.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/info">
            Otwórz informacje o naszym dniu
          </Link>
        </article>

        <article className="card card-pad hover:lift">
          <h3 className="text-lg font-semibold">Galeria zdjęć</h3>
          <p className="mt-2 muted">Pstryknij, wrzuć i podziwiaj — cała ekipa ma dostęp.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/gallery">
            Otwórz galerię
          </Link>
        </article>

        <article className="card card-pad hover:lift">
          <h3 className="text-lg font-semibold">Czat</h3>
          <p className="mt-2 muted">Umawiamy dojazdy, toasty i tańce — live.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/chat">
            Otwórz czat
          </Link>
        </article>

        <article className="card card-pad hover:lift">
          <h3 className="text-lg font-semibold">Plan stołów (PDF)</h3>
          <p className="mt-2 muted">Sprawdź, przy którym stole wylądujesz — i kto siedzi obok.</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/tables">
            Otwórz plan sali
          </Link>
        </article>

        <article className="card card-pad hover:lift">
          <h3 className="text-lg font-semibold">Prośby o piosenki</h3>
          <p className="mt-2 muted">Masz sztos numer? Dodaj i zbieraj lajki — DJ patrzy!</p>
          <Link className="nav-link nav-link-active mt-4 inline-block no-underline" href="/app/songs">
            Otwórz „Piosenki”
          </Link>
        </article>

        {/* karteczka z tipem */}
        <article className="card card-pad bg-gradient-to-br from-rose-50 to-white hover:lift">
          <h3 className="text-lg font-semibold">Pro tip</h3>
          <p className="mt-2 muted">
            Zapisz stronę na ekranie głównym telefonu — będzie działać jak mini-apka.
          </p>
        </article>
      </section>
    </div>
  )
}
