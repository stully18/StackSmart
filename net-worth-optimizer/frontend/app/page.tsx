import { CreditCard, Landmark, ShieldCheck, BarChart3 } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-semibold tracking-tight bg-gradient-to-r from-text-primary to-primary bg-clip-text text-transparent mb-4">
            College Wealth Builder
          </h1>
          <p className="text-2xl text-text-secondary mb-3">
            Financial tools built for students and new grads
          </p>
          <p className="text-text-muted max-w-2xl mx-auto">
            Optimize your debt payoff, maximize your 401(k) match, and build a personalized investment strategy
          </p>
        </div>

        <a
          href="/tools"
          className="inline-block px-12 py-5 btn-gradient rounded-xl text-2xl shadow-lg shadow-primary/20"
        >
          Get Started
        </a>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="bg-surface border border-border-subtle rounded-xl p-5 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(37,99,235,0.08)]">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <CreditCard size={24} className="text-primary" />
            </div>
            <div className="font-semibold text-text-primary mb-1">Debt Optimizer</div>
            <div className="text-xs text-text-muted">Pay debt or invest?</div>
          </div>
          <div className="bg-surface border border-border-subtle rounded-xl p-5 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(37,99,235,0.08)]">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Landmark size={24} className="text-primary" />
            </div>
            <div className="font-semibold text-text-primary mb-1">401(k) Calculator</div>
            <div className="text-xs text-text-muted">Max your match</div>
          </div>
          <div className="bg-surface border border-border-subtle rounded-xl p-5 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(37,99,235,0.08)]">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <ShieldCheck size={24} className="text-primary" />
            </div>
            <div className="font-semibold text-text-primary mb-1">Roth IRA</div>
            <div className="text-xs text-text-muted">Tax-free growth</div>
          </div>
          <div className="bg-surface border border-border-subtle rounded-xl p-5 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(37,99,235,0.08)]">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <BarChart3 size={24} className="text-primary" />
            </div>
            <div className="font-semibold text-text-primary mb-1">Investment Plan</div>
            <div className="text-xs text-text-muted">Build your portfolio</div>
          </div>
        </div>

        <div className="mt-12 text-sm text-text-muted/70">
          <p>Not financial advice. Consult a professional for personalized guidance.</p>
        </div>
      </div>
    </div>
  );
}
