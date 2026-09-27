'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const features = [
  {
    title: 'Group Management',
    description:
      'Create and manage multiple 5-aside groups with custom schedules, player caps, and fee structures. Everything in one place.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    title: 'Payment Tracking',
    description:
      'See who has paid and who hasn\'t at a glance. Mark payments as paid, pending, or waived — no more awkward WhatsApp chases.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    title: 'Session Scheduling',
    description:
      'Create match-day sessions tied to your groups. Track attendance, fees collected, and outstanding balances in real time.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: 'Instant Overview',
    description:
      'Your dashboard shows total collected, outstanding amounts, and player stats across all groups at a single glance.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];

const steps = [
  {
    number: '1',
    title: 'Create your group',
    description: 'Name it, set the fee per player, pick a schedule. Done in 30 seconds.',
  },
  {
    number: '2',
    title: 'Add your players',
    description: 'Register players with their contact info and assign them to groups.',
  },
  {
    number: '3',
    title: 'Track every session',
    description: 'Create a session, and payments are auto-generated. Mark paid with one tap.',
  },
];

const testimonials = [
  {
    quote: 'I used to spend 20 minutes after every game chasing people on WhatsApp. Now it takes me 30 seconds.',
    name: 'Marcus T.',
    role: 'Organises Tuesday & Thursday 5-a-side',
  },
  {
    quote: 'Finally, something built for us. No more spreadsheets, no more "I\'ll pay you next week" excuses.',
    name: 'Jamie K.',
    role: 'Runs 3 weekly groups across London',
  },
  {
    quote: 'The payment tracking alone saved me from losing money every single week. Game changer.',
    name: 'Daniel O.',
    role: 'Sunday league organiser',
  },
];

const faqs = [
  {
    q: 'How much does PitchAside cost?',
    a: 'Pricing details are coming soon. Sign up now to be first in line when we launch.',
  },
  {
    q: 'Does it handle actual payments?',
    a: 'Not yet — PitchAside tracks who owes what and who has paid. You still collect payments however you prefer (cash, bank transfer, etc.).',
  },
  {
    q: 'Can I manage more than one group?',
    a: 'Absolutely. Create as many groups as you need and manage them all from a single dashboard.',
  },
  {
    q: 'Do my players need accounts?',
    a: 'No. Only the organiser needs an account. Players are added by the organiser and don\'t need to sign up.',
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState({ groups: '500+', players: '4,000+', sessions: '12,000+' });

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${apiUrl}/stats/public`)
      .then((res) => res.json())
      .then((data) => {
        setStats({
          groups: `${data.groups.toLocaleString()}+`,
          players: `${data.players.toLocaleString()}+`,
          sessions: `${data.sessions.toLocaleString()}+`,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pitch-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">PitchAside</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors shadow-sm shadow-pitch-600/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative py-24 sm:py-32 lg:py-40">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-pitch-100/60 via-pitch-50/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-blue-50/50 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <div className="animate-fade-in inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pitch-50 border border-pitch-200 text-pitch-700 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-pitch-500 animate-pulse-soft" />
              Now in early access
            </div>

            <h1 className="animate-fade-in-up text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.08]">
              Stop chasing<br className="hidden sm:block" /> payments.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pitch-600 to-pitch-400">
                Start tracking.
              </span>
            </h1>

            <p className="animate-fade-in-up mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed" style={{ animationDelay: '0.15s' }}>
              The easiest way to manage your 5-aside football groups, schedule sessions, and know exactly who has paid — without the awkward WhatsApp messages.
            </p>

            <div className="animate-fade-in-up mt-10 flex flex-col sm:flex-row gap-4 justify-center" style={{ animationDelay: '0.3s' }}>
              <Link
                href="/signup"
                className="group px-8 py-3.5 bg-pitch-600 text-white font-semibold rounded-xl hover:bg-pitch-700 transition-all text-base shadow-lg shadow-pitch-600/25 hover:shadow-xl hover:shadow-pitch-600/30 hover:-translate-y-0.5"
              >
                Get Started
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-base"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* ── Hero Mockup ── */}
          <div className="animate-slide-up mt-20 max-w-4xl mx-auto" style={{ animationDelay: '0.4s' }}>
            <div className="relative rounded-2xl bg-gradient-to-b from-gray-900 to-gray-800 p-1.5 shadow-2xl shadow-gray-900/20">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-700" />
                  <div className="w-3 h-3 rounded-full bg-gray-700" />
                  <div className="w-3 h-3 rounded-full bg-gray-700" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-700/50 rounded-md px-3 py-1.5 text-xs text-gray-400 text-center">
                    pitchaside.app/dashboard
                  </div>
                </div>
              </div>

              {/* App screenshot mockup */}
              <div className="bg-gray-50 rounded-b-xl overflow-hidden">
                <div className="p-6 sm:p-8">
                  {/* Dashboard header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Dashboard</p>
                      <p className="text-lg font-bold text-gray-900 mt-0.5">Tuesday 5-a-side</p>
                    </div>
                    <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                      8/10 confirmed
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="text-xs text-gray-400 font-medium">Collected</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">&pound;85</p>
                      <p className="text-xs text-green-600 mt-1">85% of target</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="text-xs text-gray-400 font-medium">Outstanding</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">&pound;15</p>
                      <p className="text-xs text-amber-600 mt-1">2 players</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="text-xs text-gray-400 font-medium">Players</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">10</p>
                      <p className="text-xs text-gray-400 mt-1">Target reached</p>
                    </div>
                  </div>

                  {/* Player list preview */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Recent Payments</p>
                      <p className="text-xs text-gray-400">This session</p>
                    </div>
                    {[
                      { name: 'Alex Johnson', status: 'Paid', color: 'green' },
                      { name: 'Sam Williams', status: 'Paid', color: 'green' },
                      { name: 'Chris Brown', status: 'Pending', color: 'amber' },
                    ].map((p) => (
                      <div key={p.name} className="px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500">
                            {p.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          p.color === 'green'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating accent cards */}
            <div className="hidden lg:block absolute -left-8 top-1/2 -translate-y-1/2 animate-float">
              <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 border border-gray-100 p-4 w-48">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700">Payment received</span>
                </div>
                <p className="text-sm font-bold text-gray-900">&pound;10.00 from Alex J.</p>
              </div>
            </div>

            <div className="hidden lg:block absolute -right-8 top-1/3 animate-float" style={{ animationDelay: '2s' }}>
              <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 border border-gray-100 p-4 w-44">
                <p className="text-xs font-medium text-gray-400 mb-1">Collection rate</p>
                <p className="text-2xl font-bold text-gray-900">94%</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className="bg-pitch-500 h-1.5 rounded-full" style={{ width: '94%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof Stats ── */}
      <section className="py-12 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { stat: stats.groups, label: 'Groups created' },
              { stat: stats.players, label: 'Players tracked' },
              { stat: stats.sessions, label: 'Sessions logged' },
              { stat: '98%', label: 'Collection rate' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">{item.stat}</p>
                <p className="text-sm text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-pitch-600 uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Everything you need to run your pitch
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Built for 5-aside organisers who are tired of spreadsheets, group chats, and chasing people for &pound;10.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-pitch-50 text-pitch-600 flex items-center justify-center mb-5 group-hover:bg-pitch-100 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-pitch-600 uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Up and running in minutes
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Three steps. No complex setup. No onboarding calls.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-0.5 bg-gradient-to-r from-pitch-200 via-pitch-300 to-pitch-200" />

            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-pitch-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-5 shadow-lg shadow-pitch-600/25 relative z-10">
                  {step.number}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 max-w-xs mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-pitch-600 uppercase tracking-wider mb-3">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Loved by organisers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-gray-700 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 sm:py-32 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-pitch-600 uppercase tracking-wider mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Common questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-3xl bg-gradient-to-br from-pitch-600 via-pitch-700 to-pitch-800 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-2 border-white" />
              <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full border-2 border-white" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Ready to take the hassle out of match day?
              </h2>
              <p className="mt-4 text-pitch-200 max-w-xl mx-auto text-lg">
                Join hundreds of organisers who use PitchAside to track payments and manage their 5-aside groups effortlessly.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="group px-8 py-3.5 bg-white text-pitch-700 font-semibold rounded-xl hover:bg-pitch-50 transition-all text-base shadow-lg hover:-translate-y-0.5"
                >
                  Create your account
                  <span className="inline-block ml-2 transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-pitch-600 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-900">PitchAside</span>
            </div>
            <p className="text-sm text-gray-400">Payment tracking for 5-aside football groups.</p>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#features" className="hover:text-gray-600 transition-colors">Features</a>
              <a href="#faq" className="hover:text-gray-600 transition-colors">FAQ</a>
              <Link href="/signin" className="hover:text-gray-600 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
