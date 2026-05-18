/**
 * The platform Blocks Library — central registry of pre-built UI patterns.
 *
 * Each block is a small JSX renderer with Tailwind classes plus `data-edit-id`
 * attributes so the existing visual-edit selection agent (see
 * `apps/web/src/app/preview/selection-agent.tsx`) works against dropped
 * blocks identically to mock components.
 *
 * Phase 2 will let users drag these into the UI generation iframe. Phase 3
 * will bind the `placeholders` map to real schema entities.
 */

import type { BlockDefinition } from './types';

// ── Hero ─────────────────────────────────────────────────────────────────────

const heroCentered: BlockDefinition = {
  id: 'hero-centered',
  name: 'Hero · Centered',
  category: 'hero',
  tagline: 'Headline + subheadline + 2 CTAs, centered',
  placeholders: {
    eyebrow: 'PREMIUM QUALITY',
    title: 'Beautifully designed for everyday life',
    subtitle: 'Elegant products designed with intention, simplicity and quality craftsmanship.',
    primaryCta: 'Explore Collection',
    secondaryCta: 'Learn More',
  },
  render: () => (
    <section
      className="px-6 py-20 text-center bg-white dark:bg-zinc-950"
      data-edit-id="HeroCentered.root"
    >
      <div className="mx-auto max-w-2xl">
        <span
          className="inline-block px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-4"
          data-edit-id="HeroCentered.eyebrow"
        >
          PREMIUM QUALITY
        </span>
        <h1
          className="text-4xl font-semibold text-zinc-900 dark:text-white mb-3 leading-tight"
          data-edit-id="HeroCentered.title"
        >
          Beautifully designed for everyday life
        </h1>
        <p
          className="text-base text-zinc-600 dark:text-zinc-400 mb-6"
          data-edit-id="HeroCentered.subtitle"
        >
          Elegant products designed with intention, simplicity and quality craftsmanship.
        </p>
        <div className="flex gap-2 justify-center" data-edit-id="HeroCentered.actions">
          <button
            type="button"
            className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm rounded-md"
            data-edit-id="HeroCentered.primaryCta"
          >
            Explore Collection
          </button>
          <button
            type="button"
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm rounded-md"
            data-edit-id="HeroCentered.secondaryCta"
          >
            Learn More
          </button>
        </div>
      </div>
    </section>
  ),
};

const heroSplit: BlockDefinition = {
  id: 'hero-split',
  name: 'Hero · Split',
  category: 'hero',
  tagline: 'Text on left, image placeholder on right',
  placeholders: {
    title: 'Build apps faster',
    subtitle: 'A unified platform for shipping production software.',
    primaryCta: 'Get started',
  },
  render: () => (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950" data-edit-id="HeroSplit.root">
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
        <div data-edit-id="HeroSplit.text">
          <h1
            className="text-4xl font-semibold text-zinc-900 dark:text-white mb-3"
            data-edit-id="HeroSplit.title"
          >
            Build apps faster
          </h1>
          <p
            className="text-base text-zinc-600 dark:text-zinc-400 mb-5"
            data-edit-id="HeroSplit.subtitle"
          >
            A unified platform for shipping production software.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md"
            data-edit-id="HeroSplit.primaryCta"
          >
            Get started
          </button>
        </div>
        <div
          className="aspect-square rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900"
          data-edit-id="HeroSplit.image"
        />
      </div>
    </section>
  ),
};

// ── CTA ──────────────────────────────────────────────────────────────────────

const ctaSimple: BlockDefinition = {
  id: 'cta-simple',
  name: 'CTA · Simple banner',
  category: 'cta',
  tagline: 'Full-width banner with one action',
  placeholders: { title: 'Ready to ship?', cta: 'Start free trial' },
  render: () => (
    <section
      className="px-6 py-12 bg-zinc-900 dark:bg-zinc-100 text-center"
      data-edit-id="CtaSimple.root"
    >
      <h2
        className="text-2xl font-semibold text-white dark:text-zinc-900 mb-4"
        data-edit-id="CtaSimple.title"
      >
        Ready to ship?
      </h2>
      <button
        type="button"
        className="px-5 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm rounded-md"
        data-edit-id="CtaSimple.cta"
      >
        Start free trial
      </button>
    </section>
  ),
};

// ── Features ─────────────────────────────────────────────────────────────────

const featureGrid3Col: BlockDefinition = {
  id: 'feature-grid-3col',
  name: 'Features · 3-column grid',
  category: 'features',
  tagline: 'Three feature cards in a row',
  placeholders: {
    title: 'Everything you need',
    feature1Title: 'Fast',
    feature2Title: 'Reliable',
    feature3Title: 'Open',
  },
  render: () => (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950" data-edit-id="FeatureGrid3Col.root">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-semibold text-zinc-900 dark:text-white mb-8 text-center"
          data-edit-id="FeatureGrid3Col.title"
        >
          Everything you need
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { id: 'one', title: 'Fast' },
            { id: 'two', title: 'Reliable' },
            { id: 'three', title: 'Open' },
          ].map((f) => (
            <div
              key={f.id}
              className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800"
              data-edit-id={`FeatureGrid3Col.feature.${f.id}`}
            >
              <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-950 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                {f.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Concise description of this feature and what it does for the user.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
};

// ── Pricing ──────────────────────────────────────────────────────────────────

const pricing3Tier: BlockDefinition = {
  id: 'pricing-3tier',
  name: 'Pricing · 3-tier',
  category: 'pricing',
  tagline: 'Free / Pro / Enterprise columns',
  placeholders: {
    tier1: 'Free',
    tier2: 'Pro',
    tier3: 'Enterprise',
    price1: '$0',
    price2: '$29',
    price3: 'Custom',
  },
  render: () => (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950" data-edit-id="Pricing3Tier.root">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-semibold text-zinc-900 dark:text-white mb-8 text-center"
          data-edit-id="Pricing3Tier.title"
        >
          Pricing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'free', name: 'Free', price: '$0', featured: false },
            { id: 'pro', name: 'Pro', price: '$29', featured: true },
            { id: 'ent', name: 'Enterprise', price: 'Custom', featured: false },
          ].map((tier) => (
            <div
              key={tier.id}
              className={`p-5 rounded-lg border ${
                tier.featured
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
              data-edit-id={`Pricing3Tier.tier.${tier.id}`}
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                {tier.name}
              </div>
              <div className="text-3xl font-semibold text-zinc-900 dark:text-white mb-3">
                {tier.price}
              </div>
              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                <li>· Feature one</li>
                <li>· Feature two</li>
                <li>· Feature three</li>
              </ul>
              <button
                type="button"
                className={`w-full py-1.5 text-xs rounded-md ${
                  tier.featured
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'
                }`}
              >
                {tier.name === 'Enterprise' ? 'Contact sales' : 'Get started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
};

// ── Testimonial ──────────────────────────────────────────────────────────────

const testimonialQuote: BlockDefinition = {
  id: 'testimonial-quote',
  name: 'Testimonial · Pull quote',
  category: 'testimonial',
  tagline: 'Single large quote with attribution',
  placeholders: { quote: '“…”', author: 'Author Name', role: 'Title at Company' },
  render: () => (
    <section
      className="px-6 py-16 bg-zinc-50 dark:bg-zinc-900"
      data-edit-id="TestimonialQuote.root"
    >
      <div className="mx-auto max-w-2xl text-center">
        <blockquote
          className="text-xl font-medium text-zinc-900 dark:text-white mb-4 leading-relaxed"
          data-edit-id="TestimonialQuote.quote"
        >
          “This changed how we ship software. The team is more focused, the workflow is cleaner, and
          our customers can feel the difference.”
        </blockquote>
        <div
          className="text-sm text-zinc-600 dark:text-zinc-400"
          data-edit-id="TestimonialQuote.author"
        >
          <span className="font-medium text-zinc-900 dark:text-white">Jane Doe</span> · Engineering
          Lead at Acme
        </div>
      </div>
    </section>
  ),
};

// ── Stats ────────────────────────────────────────────────────────────────────

const statsRow: BlockDefinition = {
  id: 'stats-row',
  name: 'Stats · 4-up',
  category: 'stats',
  tagline: 'Row of four headline numbers',
  placeholders: { stat1: '99.9%', stat2: '12k+', stat3: '3.2s', stat4: '24/7' },
  render: () => (
    <section className="px-6 py-12 bg-white dark:bg-zinc-950" data-edit-id="StatsRow.root">
      <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[
          { id: 'uptime', value: '99.9%', label: 'Uptime' },
          { id: 'users', value: '12k+', label: 'Active users' },
          { id: 'p95', value: '3.2s', label: 'P95 latency' },
          { id: 'support', value: '24/7', label: 'Support' },
        ].map((s) => (
          <div key={s.id} className="text-center" data-edit-id={`StatsRow.stat.${s.id}`}>
            <div className="text-3xl font-semibold text-zinc-900 dark:text-white mb-1">
              {s.value}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  ),
};

// ── Auth ─────────────────────────────────────────────────────────────────────

const authSignIn: BlockDefinition = {
  id: 'auth-signin',
  name: 'Auth · Sign in',
  category: 'auth',
  tagline: 'Email + password sign-in form',
  placeholders: { title: 'Welcome back', submit: 'Sign in' },
  render: () => (
    <section
      className="min-h-[60vh] flex items-center justify-center px-6 py-12 bg-white dark:bg-zinc-950"
      data-edit-id="AuthSignIn.root"
    >
      <div
        className="w-full max-w-sm border border-zinc-200 dark:border-zinc-800 rounded-lg p-6"
        data-edit-id="AuthSignIn.card"
      >
        <h2
          className="text-lg font-semibold text-zinc-900 dark:text-white mb-1"
          data-edit-id="AuthSignIn.title"
        >
          Welcome back
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">Sign in to continue.</p>
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="AuthSignIn.email"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="AuthSignIn.password"
          />
          <button
            type="button"
            className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm rounded-md"
            data-edit-id="AuthSignIn.submit"
          >
            Sign in
          </button>
        </div>
      </div>
    </section>
  ),
};

const authSignUp: BlockDefinition = {
  id: 'auth-signup',
  name: 'Auth · Sign up',
  category: 'auth',
  tagline: 'Name + email + password sign-up form',
  render: () => (
    <section
      className="min-h-[60vh] flex items-center justify-center px-6 py-12 bg-white dark:bg-zinc-950"
      data-edit-id="AuthSignUp.root"
    >
      <div
        className="w-full max-w-sm border border-zinc-200 dark:border-zinc-800 rounded-lg p-6"
        data-edit-id="AuthSignUp.card"
      >
        <h2
          className="text-lg font-semibold text-zinc-900 dark:text-white mb-1"
          data-edit-id="AuthSignUp.title"
        >
          Create your account
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">It only takes a moment.</p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Full name"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="AuthSignUp.name"
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="AuthSignUp.email"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="AuthSignUp.password"
          />
          <button
            type="button"
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-md"
            data-edit-id="AuthSignUp.submit"
          >
            Create account
          </button>
        </div>
      </div>
    </section>
  ),
};

// ── Form ─────────────────────────────────────────────────────────────────────

const contactForm: BlockDefinition = {
  id: 'form-contact',
  name: 'Form · Contact',
  category: 'form',
  tagline: 'Name + email + message',
  render: () => (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950" data-edit-id="ContactForm.root">
      <div className="mx-auto max-w-md">
        <h2
          className="text-xl font-semibold text-zinc-900 dark:text-white mb-4"
          data-edit-id="ContactForm.title"
        >
          Get in touch
        </h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Name"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="ContactForm.name"
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
            data-edit-id="ContactForm.email"
          />
          <textarea
            placeholder="Message"
            rows={4}
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 resize-none"
            data-edit-id="ContactForm.message"
          />
          <button
            type="button"
            className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm rounded-md"
            data-edit-id="ContactForm.submit"
          >
            Send message
          </button>
        </div>
      </div>
    </section>
  ),
};

// ── Header (Chrome) ──────────────────────────────────────────────────────────

const headerWithNav: BlockDefinition = {
  id: 'header-with-nav',
  name: 'Header · Logo + nav + CTA',
  category: 'header',
  tagline: 'Top navigation chrome',
  render: () => (
    <header
      className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
      data-edit-id="HeaderWithNav.root"
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div
            className="text-sm font-semibold text-zinc-900 dark:text-white"
            data-edit-id="HeaderWithNav.logo"
          >
            Essence
          </div>
          <nav className="flex items-center gap-4" data-edit-id="HeaderWithNav.nav">
            {['Home', 'Products', 'About', 'Contact'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                data-edit-id={`HeaderWithNav.nav.${item}`}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400"
            data-edit-id="HeaderWithNav.signIn"
          >
            Sign in
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md"
            data-edit-id="HeaderWithNav.signUp"
          >
            Sign up
          </button>
        </div>
      </div>
    </header>
  ),
};

// ── Footer (Chrome) ──────────────────────────────────────────────────────────

const footer4Col: BlockDefinition = {
  id: 'footer-4col',
  name: 'Footer · 4-column',
  category: 'footer',
  tagline: 'Logo + links + legal',
  render: () => (
    <footer
      className="px-6 py-12 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800"
      data-edit-id="Footer4Col.root"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div data-edit-id="Footer4Col.brand">
            <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Essence</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Beautifully designed for everyday life.
            </p>
          </div>
          {[
            { id: 'product', label: 'Product', items: ['Overview', 'Features', 'Pricing'] },
            { id: 'company', label: 'Company', items: ['About', 'Blog', 'Careers'] },
            { id: 'legal', label: 'Legal', items: ['Privacy', 'Terms', 'Cookies'] },
          ].map((col) => (
            <div key={col.id} data-edit-id={`Footer4Col.col.${col.id}`}>
              <div className="text-xs font-semibold text-zinc-900 dark:text-white mb-2">
                {col.label}
              </div>
              <ul className="space-y-1">
                {col.items.map((it) => (
                  <li key={it}>
                    <a href="#" className="text-xs text-zinc-600 dark:text-zinc-400">
                      {it}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
          © 2026 Essence. All rights reserved.
        </div>
      </div>
    </footer>
  ),
};

// ── Table ────────────────────────────────────────────────────────────────────

const tableSimple: BlockDefinition = {
  id: 'table-simple',
  name: 'Table · Simple list',
  category: 'table',
  tagline: 'Three-column list with row actions',
  render: () => (
    <section className="px-6 py-8 bg-white dark:bg-zinc-950" data-edit-id="TableSimple.root">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-semibold text-zinc-900 dark:text-white"
            data-edit-id="TableSimple.title"
          >
            Contacts
          </h2>
          <button type="button" className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md">
            New contact
          </button>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-2 text-xs font-medium text-zinc-500">Name</th>
              <th className="text-left py-2 text-xs font-medium text-zinc-500">Email</th>
              <th className="text-left py-2 text-xs font-medium text-zinc-500">Created</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: '1', name: 'Alice Johnson', email: 'alice@example.com', when: 'Today' },
              { id: '2', name: 'Bob Smith', email: 'bob@example.com', when: 'Yesterday' },
              { id: '3', name: 'Carol Davis', email: 'carol@example.com', when: '3 days ago' },
            ].map((row) => (
              <tr
                key={row.id}
                className="border-b border-zinc-100 dark:border-zinc-900"
                data-edit-id={`TableSimple.row.${row.id}`}
              >
                <td className="py-2 text-zinc-900 dark:text-white">{row.name}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{row.email}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{row.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  ),
};

// ── Dashboard ────────────────────────────────────────────────────────────────

const dashboardStatsCards: BlockDefinition = {
  id: 'dashboard-stats-cards',
  name: 'Dashboard · Stat cards',
  category: 'dashboard',
  tagline: 'Four KPI cards with trend',
  render: () => (
    <section
      className="px-6 py-8 bg-white dark:bg-zinc-950"
      data-edit-id="DashboardStatsCards.root"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-lg font-semibold text-zinc-900 dark:text-white mb-4"
          data-edit-id="DashboardStatsCards.title"
        >
          Dashboard
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { id: 'mrr', label: 'MRR', value: '$48,210', delta: '+12%' },
            { id: 'users', label: 'Active users', value: '8,140', delta: '+4%' },
            { id: 'churn', label: 'Churn', value: '2.1%', delta: '−0.3%' },
            { id: 'nps', label: 'NPS', value: '64', delta: '+2' },
          ].map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800"
              data-edit-id={`DashboardStatsCards.card.${s.id}`}
            >
              <div className="text-xs text-zinc-500 mb-1">{s.label}</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{s.delta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const BLOCKS: BlockDefinition[] = [
  heroCentered,
  heroSplit,
  ctaSimple,
  featureGrid3Col,
  pricing3Tier,
  testimonialQuote,
  statsRow,
  authSignIn,
  authSignUp,
  contactForm,
  headerWithNav,
  footer4Col,
  tableSimple,
  dashboardStatsCards,
];

export function getBlock(id: string): BlockDefinition | undefined {
  return BLOCKS.find((b) => b.id === id);
}

export function getBlocksByCategory(category: string): BlockDefinition[] {
  if (category === 'all') return BLOCKS;
  return BLOCKS.filter((b) => b.category === category);
}
