/**
 * Hand-authored source strings for the 14 blocks in the registry.
 *
 * Why hand-authored: JSX renderers in `registry.tsx` would need a Babel-based
 * serializer to convert back to source, which is overkill for v1. The strings
 * here are the canonical "what this block looks like as code" — pasted into a
 * customer project (post-generation) they'd compile and render identically to
 * the live block.
 *
 * Kept in sync with `registry.tsx` by convention. If you change a block's JSX
 * there, update the source string here too. (Phase 2 of the live-code work
 * automates this round-trip.)
 */

export const BLOCK_SOURCES: Record<string, string> = {
  'hero-centered': `export function HeroCentered() {
  return (
    <section className="px-6 py-20 text-center bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl">
        <span className="inline-block px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-4">
          PREMIUM QUALITY
        </span>
        <h1 className="text-4xl font-semibold text-zinc-900 dark:text-white mb-3 leading-tight">
          Beautifully designed for everyday life
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400 mb-6">
          Elegant products designed with intention, simplicity and quality craftsmanship.
        </p>
        <div className="flex gap-2 justify-center">
          <button className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm rounded-md">
            Explore Collection
          </button>
          <button className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm rounded-md">
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}`,

  'hero-split': `export function HeroSplit() {
  return (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-white mb-3">
            Build apps faster
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 mb-5">
            A unified platform for shipping production software.
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md">
            Get started
          </button>
        </div>
        <div className="aspect-square rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
      </div>
    </section>
  );
}`,

  'cta-simple': `export function CtaSimple() {
  return (
    <section className="px-6 py-12 bg-zinc-900 dark:bg-zinc-100 text-center">
      <h2 className="text-2xl font-semibold text-white dark:text-zinc-900 mb-4">
        Ready to ship?
      </h2>
      <button className="px-5 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm rounded-md">
        Start free trial
      </button>
    </section>
  );
}`,

  'feature-grid-3col': `const FEATURES = [
  { id: 'one', title: 'Fast' },
  { id: 'two', title: 'Reliable' },
  { id: 'three', title: 'Open' },
];

export function FeatureGrid3Col() {
  return (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-8 text-center">
          Everything you need
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.id} className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800">
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
  );
}`,

  'pricing-3tier': `const TIERS = [
  { id: 'free', name: 'Free', price: '$0', featured: false },
  { id: 'pro', name: 'Pro', price: '$29', featured: true },
  { id: 'ent', name: 'Enterprise', price: 'Custom', featured: false },
];

export function Pricing3Tier() {
  return (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-8 text-center">
          Pricing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={\`p-5 rounded-lg border \${
                tier.featured ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200 dark:border-zinc-800'
              }\`}
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">{tier.name}</div>
              <div className="text-3xl font-semibold text-zinc-900 dark:text-white mb-3">{tier.price}</div>
              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                <li>· Feature one</li>
                <li>· Feature two</li>
                <li>· Feature three</li>
              </ul>
              <button
                className={\`w-full py-1.5 text-xs rounded-md \${
                  tier.featured ? 'bg-blue-600 text-white' : 'border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'
                }\`}
              >
                {tier.name === 'Enterprise' ? 'Contact sales' : 'Get started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,

  'testimonial-quote': `export function TestimonialQuote() {
  return (
    <section className="px-6 py-16 bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-2xl text-center">
        <blockquote className="text-xl font-medium text-zinc-900 dark:text-white mb-4 leading-relaxed">
          “This changed how we ship software. The team is more focused, the workflow is
          cleaner, and our customers can feel the difference.”
        </blockquote>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-white">Jane Doe</span> · Engineering Lead at Acme
        </div>
      </div>
    </section>
  );
}`,

  'stats-row': `const STATS = [
  { id: 'uptime', value: '99.9%', label: 'Uptime' },
  { id: 'users', value: '12k+', label: 'Active users' },
  { id: 'p95', value: '3.2s', label: 'P95 latency' },
  { id: 'support', value: '24/7', label: 'Support' },
];

export function StatsRow() {
  return (
    <section className="px-6 py-12 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-4 gap-6">
        {STATS.map((s) => (
          <div key={s.id} className="text-center">
            <div className="text-3xl font-semibold text-zinc-900 dark:text-white mb-1">{s.value}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}`,

  'auth-signin': `export function AuthSignIn() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6 py-12 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Welcome back</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">Sign in to continue.</p>
        <div className="space-y-3">
          <input type="email" placeholder="Email" className="w-full px-3 py-2 text-sm border rounded-md" />
          <input type="password" placeholder="Password" className="w-full px-3 py-2 text-sm border rounded-md" />
          <button className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm rounded-md">
            Sign in
          </button>
        </div>
      </div>
    </section>
  );
}`,

  'auth-signup': `export function AuthSignUp() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6 py-12 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Create your account</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">It only takes a moment.</p>
        <div className="space-y-3">
          <input type="text" placeholder="Full name" className="w-full px-3 py-2 text-sm border rounded-md" />
          <input type="email" placeholder="Email" className="w-full px-3 py-2 text-sm border rounded-md" />
          <input type="password" placeholder="Password" className="w-full px-3 py-2 text-sm border rounded-md" />
          <button className="w-full py-2 bg-blue-600 text-white text-sm rounded-md">Create account</button>
        </div>
      </div>
    </section>
  );
}`,

  'form-contact': `export function ContactForm() {
  return (
    <section className="px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-md">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">Get in touch</h2>
        <div className="space-y-3">
          <input type="text" placeholder="Name" className="w-full px-3 py-2 text-sm border rounded-md" />
          <input type="email" placeholder="Email" className="w-full px-3 py-2 text-sm border rounded-md" />
          <textarea placeholder="Message" rows={4} className="w-full px-3 py-2 text-sm border rounded-md resize-none" />
          <button className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm rounded-md">
            Send message
          </button>
        </div>
      </div>
    </section>
  );
}`,

  'header-with-nav': `const NAV_ITEMS = ['Home', 'Products', 'About', 'Contact'];

export function HeaderWithNav() {
  return (
    <header className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">Essence</div>
          <nav className="hidden sm:flex items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <a key={item} href="#" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm text-zinc-600">Sign in</button>
          <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md">Sign up</button>
        </div>
      </div>
    </header>
  );
}`,

  'footer-4col': `const COLUMNS = [
  { id: 'product', label: 'Product', items: ['Overview', 'Features', 'Pricing'] },
  { id: 'company', label: 'Company', items: ['About', 'Blog', 'Careers'] },
  { id: 'legal', label: 'Legal', items: ['Privacy', 'Terms', 'Cookies'] },
];

export function Footer4Col() {
  return (
    <footer className="px-6 py-12 bg-zinc-50 dark:bg-zinc-900 border-t">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Essence</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Beautifully designed for everyday life.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.id}>
              <div className="text-xs font-semibold text-zinc-900 dark:text-white mb-2">{col.label}</div>
              <ul className="space-y-1">
                {col.items.map((it) => (
                  <li key={it}>
                    <a href="#" className="text-xs text-zinc-600 dark:text-zinc-400">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t text-xs text-zinc-600">© 2026 Essence. All rights reserved.</div>
      </div>
    </footer>
  );
}`,

  'table-simple': `const ROWS = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', when: 'Today' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', when: 'Yesterday' },
  { id: '3', name: 'Carol Davis', email: 'carol@example.com', when: '3 days ago' },
];

export function TableSimple() {
  return (
    <section className="px-6 py-8 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Contacts</h2>
          <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md">New contact</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs font-medium text-zinc-500">Name</th>
                <th className="text-left py-2 text-xs font-medium text-zinc-500">Email</th>
                <th className="text-left py-2 text-xs font-medium text-zinc-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-zinc-600">{row.email}</td>
                  <td className="py-2 text-zinc-600">{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}`,

  'dashboard-stats-cards': `const STATS = [
  { id: 'mrr', label: 'MRR', value: '$48,210', delta: '+12%' },
  { id: 'users', label: 'Active users', value: '8,140', delta: '+4%' },
  { id: 'churn', label: 'Churn', value: '2.1%', delta: '−0.3%' },
  { id: 'nps', label: 'NPS', value: '64', delta: '+2' },
];

export function DashboardStatsCards() {
  return (
    <section className="px-6 py-8 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.id} className="p-4 rounded-lg border">
              <div className="text-xs text-zinc-500 mb-1">{s.label}</div>
              <div className="text-xl font-semibold">{s.value}</div>
              <div className="text-xs text-emerald-600 mt-1">{s.delta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
};

export function getBlockSource(id: string): string | undefined {
  return BLOCK_SOURCES[id];
}
