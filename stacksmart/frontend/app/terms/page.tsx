import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Use — StackSmart',
  description: 'Terms and conditions for using StackSmart financial tools.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-text-muted hover:text-text-secondary transition-colors mb-8 inline-block"
        >
          ← Back to home
        </Link>

        <h1 className="font-serif text-4xl tracking-[-0.03em] text-text-primary mb-2">Terms of Use</h1>
        <p className="text-text-muted text-sm mb-12">Last updated: April 3, 2026</p>

        <div className="prose prose-invert max-w-none space-y-10 text-text-secondary leading-[1.8]">

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using StackSmart, you agree to be bound by these Terms of Use. If you do
              not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">2. Not Financial Advice</h2>
            <p>
              StackSmart provides financial calculation tools for educational and informational purposes
              only. The outputs — including recommendations on debt payoff strategies, retirement
              contributions, and investment portfolio allocations — are <strong className="text-text-primary">not
              financial advice</strong> and should not be treated as such.
            </p>
            <p className="mt-3">
              Always consult a licensed financial advisor before making significant financial decisions.
              Past market performance does not guarantee future results.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">3. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. You
              agree not to share your account with others or use StackSmart for any unlawful purpose.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">4. Accuracy of Information</h2>
            <p>
              While we strive to provide accurate calculations and market data, StackSmart makes no
              warranties about the accuracy, completeness, or timeliness of information provided by the
              tools. Market data is sourced from third parties and may be delayed.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">5. Limitation of Liability</h2>
            <p>
              StackSmart and its operators shall not be liable for any financial losses, damages, or
              decisions made based on the outputs of these tools. Use at your own discretion.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">6. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl text-text-primary mb-3">7. Contact</h2>
            <p>
              Questions about these terms? Contact us through the information provided on our website.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
