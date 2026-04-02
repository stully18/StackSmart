'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { CreditCard, Landmark, ShieldCheck, BarChart3 } from 'lucide-react'

const tools = [
  { icon: CreditCard, name: 'Debt Optimizer' },
  { icon: Landmark, name: '401(k) Calculator' },
  { icon: ShieldCheck, name: 'Roth IRA Planner' },
  { icon: BarChart3, name: 'Investment Plan' },
]

export default function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className="py-16 px-6 flex justify-center">
      <motion.div
        ref={ref}
        className="animate-float"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="glass-card rounded-2xl p-1 max-w-2xl w-full shadow-[0_20px_80px_rgba(190,255,0,0.06)]"
          style={{ transform: 'perspective(1200px) rotateX(4deg) rotateY(-3deg)' }}
        >
          {/* Window chrome */}
          <div className="bg-surface rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>

            {/* Tool cards grid */}
            <div className="grid grid-cols-2 gap-3 p-4">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="bg-surface-elevated rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <tool.icon size={18} className="text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-text-primary">{tool.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
