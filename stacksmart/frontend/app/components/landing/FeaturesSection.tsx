'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { CreditCard, Landmark, ShieldCheck, BarChart3, type LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  name: string
  description: string
}

const features: Feature[] = [
  {
    icon: CreditCard,
    name: 'Debt Optimizer',
    description:
      'Compare paying off debt vs. investing. Get a data-driven recommendation based on real market returns.',
  },
  {
    icon: Landmark,
    name: '401(k) Calculator',
    description:
      'Calculate your employer match, see how much free money you\u2019re leaving on the table, and project your retirement savings.',
  },
  {
    icon: ShieldCheck,
    name: 'Roth IRA Planner',
    description:
      'Model tax-free growth scenarios and see why starting early can mean hundreds of thousands more in retirement.',
  },
  {
    icon: BarChart3,
    name: 'Investment Plan Builder',
    description:
      'Get a personalized ETF portfolio allocation based on your risk tolerance, goals, and timeline.',
  },
]

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '0px', amount: 0 })

  return (
    <section ref={sectionRef} className="py-16 md:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-serif text-4xl md:text-5xl text-text-primary tracking-[-0.03em] mb-4">
            Everything You Need
          </h2>
          <p className="text-text-secondary text-lg leading-[1.7]">
            Four powerful tools to take control of your financial future
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.name}
              className="glass-card rounded-2xl p-6 glow-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon size={22} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.name}</h3>
              <p className="text-text-secondary leading-[1.7] text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
