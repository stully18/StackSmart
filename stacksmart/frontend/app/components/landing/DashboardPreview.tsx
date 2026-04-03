'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { TrendingUp, CreditCard, Check } from 'lucide-react'

export default function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px', amount: 0 })

  return (
    <section className="py-16 px-6 flex justify-center">
      <motion.div
        ref={ref}
        className="animate-float w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="glass-card rounded-2xl p-1 shadow-[0_20px_80px_rgba(190,255,0,0.07)]"
          style={{ transform: 'perspective(1200px) rotateX(4deg) rotateY(-3deg)' }}
        >
          {/* Window chrome */}
          <div className="bg-surface rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs text-text-muted/50 font-mono">stacksmart.app/tools/debt-optimizer</span>
            </div>

            {/* Simulated tool result */}
            <div className="p-5 space-y-3">
              {/* Recommendation card */}
              <div className="border-l-4 border-l-primary rounded-xl p-4 bg-surface-elevated/50 border border-border-subtle">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={20} className="text-primary" />
                  <span className="font-semibold text-text-primary">Start Investing</span>
                  <span className="ml-auto text-xs text-text-muted bg-primary/10 px-2 py-0.5 rounded-full text-primary font-medium">87% confidence</span>
                </div>
                <ul className="space-y-1">
                  {[
                    'Your 5.2% loan rate is below the 10% market average',
                    'Employer 401(k) match adds 3% — guaranteed return',
                  ].map((r) => (
                    <li key={r} className="text-xs text-text-secondary flex items-start gap-1.5">
                      <Check size={11} className="text-primary mt-0.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Two small cards side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-elevated rounded-xl p-3">
                  <div className="text-xs text-text-muted mb-1">Student Loan</div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-semibold text-text-primary">$24,500</span>
                    <span className="text-xs text-text-muted">5.2% APR</span>
                  </div>
                  <div className="mt-2 h-1 bg-surface rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-warning/60 rounded-full" />
                  </div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3">
                  <div className="text-xs text-text-muted mb-1">Monthly Budget</div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-semibold text-primary">$400</span>
                    <CreditCard size={14} className="text-text-muted" />
                  </div>
                  <div className="mt-2 flex gap-1">
                    <span className="text-xs text-text-muted">→ $200 invest</span>
                    <span className="text-xs text-text-muted/50">+</span>
                    <span className="text-xs text-text-muted">$200 debt</span>
                  </div>
                </div>
              </div>

              {/* Projected growth bar */}
              <div className="bg-surface-elevated/40 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-text-muted">10-year projection</span>
                  <span className="text-sm font-semibold text-primary">+$38,400</span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-gradient-to-r from-primary to-accent-violet rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
