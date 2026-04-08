import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — StackSmart',
  description: 'How StackSmart collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-text-muted hover:text-text-secondary transition-colors mb-8 inline-block"
        >
          ← Back to home
        </Link>

        <h1 className="font-serif text-4xl tracking-[-0.03em] text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-text-muted text-sm mb-12">Last updated: April 3, 2026</p>

        <div className="prose prose-invert max-w-none space-y-10 text-text-secondary leading-[1.8]">

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">1. Information We Collect</h2>
            <p>
              StackSmart collects information you provide directly, including your email address and password
              when you create an account. We also collect financial data you enter into our tools — such as
              loan balances, interest rates, and monthly budgets — to generate your personalized recommendations.
            </p>
            <p className="mt-3">
              This data is processed in real time to produce results and is not stored on our servers beyond
              your active session unless you explicitly save a plan.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and operate the StackSmart financial tools</li>
              <li>To authenticate your account and maintain your session</li>
              <li>To improve the accuracy and performance of our optimization algorithms</li>
              <li>To send transactional emails (e.g., password reset)</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">3. Data Storage & Security</h2>
            <p>
              Your account information is stored securely via Supabase, which provides industry-standard
              encryption at rest and in transit. Financial data you enter into the tools is transmitted
              over HTTPS and processed server-side to generate results.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">4. Third-Party Services</h2>
            <p>
              StackSmart uses the following third-party services:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-text-primary">Supabase</strong> — authentication and database</li>
              <li><strong className="text-text-primary">Vercel</strong> — hosting and edge delivery</li>
              <li><strong className="text-text-primary">yfinance / Yahoo Finance</strong> — live market data (no personal data shared)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">5. Your Rights</h2>
            <p>
              You may request deletion of your account and associated data at any time by contacting us.
              You can also update your email and password from the Settings page.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">6. Contact</h2>
            <p>
              If you have questions about this privacy policy or want to request deletion of your data,
              please email us at{' '}
              <a href="mailto:hello@stacksmart.io" className="text-primary hover:text-primary-hover transition-colors">
                hello@stacksmart.io
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
