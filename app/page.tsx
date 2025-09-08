'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

type FeatureProps = {
  title: string
  desc: string
  href: string
}

/** Karta funkcji (lekki efekt reveal + lift) */
function Feature({ title, desc, href }: FeatureProps) {
  return (
    <article
      data-reveal
      className="rounded-2xl border bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="p-6 md:p-8">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{desc}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-white px-4 py-2 rounded-md bg-[rgb(var(--brand-600))] hover:bg-[rgb(var(--brand-700))] no-underline"
        >
          Otwórz
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  )
}

export default function Home() {
  const supabase = supaClient()
  const [authed, setAuthed] = useState<boolean | null>(null)

  // HERO: interaktywny gradient + konfetti
  const heroRef = useRef<HTMLDivElement | null>(null)
  const confettiRef = useRef<HTMLCanvasElement | null>(null)
  const rafId = useRef<number | null>(null)

  // sprawdź sesję (czy pokazać przycisk "Zaloguj się")
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setAuthed(!!session)
    })
    return () => {
      mounted = false
    }
  }, [])

  // reveal – pojedynczy observer do elementów z [data-reveal]
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!els.length) return
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  // interaktywny spotlight w hero
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = heroRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100
    el.style.setProperty('--mx', `${x}%`)
    el.style.setProperty('--my', `${y}%`)
  }

  // bezpieczne konfetti (TS-friendly)
  function fireConfetti() {
    const c = confettiRef.current
    const el = heroRef.current
    if (!c || !el) return

    // zamrożone wymiary na czas animacji
    const width = el.clientWidth
    const height = el.clientHeight

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
    c.width = width * dpr
    c.height = height * dpr
    c.style.width = `${width}px`
    c.style.height = `${height}px`

    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    type P = {
      x: number
      y: number
      vx: number
      vy: number
      w: number
      h: number
      r: number
      vr: number
      color: string
      life: number
    }

    const colors = ['#f43f5e', '#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#eab308', '#f59e0b']
    const parts: P[] = []
    const count = 140
    for (let i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * width,
        y: -20 + Math.random() * 20,
        vx: -1 + Math.random() * 2,
        vy: 2 + Math.random() * 3,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        r: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4,
        color: colors[i % colors.length],
        life: 1 + Math.random() * 1.2,
      })
    }

    let t0 = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.033, (t - t0) / 1000)
      t0 = t
      ctx.clearRect(0, 0, width, height)
      let alive = 0
      for (const p of parts) {
        p.x += p.vx * 60 * dt
        p.y += p.vy * 60 * dt
        p.vy += 0.03 * 60 * dt
        p.r += p.vr * 60 * dt
        p.life -= 0.015 * 60 * dt
        if (p.life <= 0) continue
        alive++

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (alive > 0) {
        rafId.current = requestAnimationFrame(loop)
      } else {
        ctx.clearRect(0, 0, width, height)
        rafId.current = null
      }
    }
    rafId.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    // cleanup ewentualnej animacji
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <>
      {/* HERO */}
      <section
        ref={heroRef}
        onPointerMove={onPointerMove}
        className="relative overflow-hidden rounded-3xl border shadow-sm bg-white"
      >
        {/* interaktywny spotlight */}
        <div className="absolute inset-0 -z-10 hero-spotlight" />
        {/* tła / gradienty */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-rose-50 to-sky-50" />
        <canvas
          ref={confettiRef}
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
        />
        <div className="p-6 md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(var(--brand-100))] text-[rgb(var(--brand-700))]">
            Aplikacja weselna
            <span className="sparkle" aria-hidden>✦</span>
          </span>

          <h1 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
            Witamy na naszej stronie weselnej 🎉 Agatka i Damian
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Zaloguj się, aby zobaczyć najważniejsze informacje, galerię zdjęć, czat gości oraz plan stołów w PDF.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {authed === false && (
              <Link href="/login" className="no-underline">
                <span className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition bg-[rgb(var(--brand-600))] hover:bg-[rgb(var(--brand-700))]">
                  Zaloguj się
                </span>
              </Link>
            )}
            <Link href="/app" className="no-underline">
              <span className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-[rgb(var(--brand-700))] hover:bg-[rgba(var(--brand-100),.6)] transition">
                Przejdź do panelu
              </span>
            </Link>
            <button
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition bg-black/80 hover:bg-black"
              onClick={fireConfetti}
              type="button"
            >
              🎊 Zbij piątkę!
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Pro tip: Zapisz stronę na ekranie głównym telefonu – będzie działać jak mini-apka.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-5 md:grid-cols-2 mt-10">
        <Feature
          title="Najważniejsze informacje"
          href="/app/info"
          desc="Godziny, lokalizacja, dojazd i istotne punkty. Organizer edytuje treść na bieżąco."
        />
        <Feature
          title="Galeria zdjęć"
          href="/app/gallery"
          desc="Wrzucaj fotki i pobieraj paczki .zip. Wszystko leci do chmury."
        />
        <Feature
          title="Czat"
          href="/app/chat"
          desc="Rozmowy w czasie rzeczywistym — wygodnie i bez instalacji."
        />
        <Feature
          title="Plan stołów (PDF)"
          href="/app/tables"
          desc="Sprawdź, przy którym stole wylądujesz — i kto siedzi obok."
        />
        <Feature
          title="Prośby o piosenki"
          href="/app/songs"
          desc="Masz sztos numer? Dodaj i zbieraj lajki — DJ patrzy!"
        />
        <Feature
          title="DJ box"
          href="/dj"
          desc="Strefa dla DJ-a: szybkie zarządzanie kolejką i zagranymi."
        />
      </section>

      {/* local styles (tylko dla tej strony) */}
      <style jsx global>{`
        /* reveal */
        [data-reveal] {
          opacity: 0;
          transform: translateY(6px) scale(0.98);
          transition: opacity 500ms ease, transform 500ms ease;
        }
        .reveal-in {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }

        /* spotlight w hero – sterowany zmiennymi --mx/--my */
        .hero-spotlight {
          --mx: 50%;
          --my: 0%;
          background:
            radial-gradient(500px 200px at var(--mx) var(--my), rgba(199,146,125,0.15), transparent 70%),
            radial-gradient(800px 350px at 100% 20%, rgba(254,231,240,0.5), transparent);
        }

        /* delikatna animacja gwiazdki w pigułce */
        .sparkle {
          display: inline-block;
          animation: sparkle 2s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        @keyframes sparkle {
          0%, 100% { transform: rotate(0deg) scale(1); opacity: 1; }
          50%      { transform: rotate(12deg) scale(1.15); opacity: .85; }
        }
      `}</style>
    </>
  )
}
