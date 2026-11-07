'use client'

import { useMotionPreference } from '@/app/components/MotionPreferences'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const stats = [
  { value: '4', label: 'Powerful Tools' },
  { value: '100%', label: 'Free to Use' },
  { value: 'Bank-Level', label: 'Security' },
  { value: 'Built for', label: 'Early Careers' },
]

export default function StatsSection() {
  const reducedMotion = useMotionPreference()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px', amount: 0 })

  return (
    <section ref={ref} className="py-14 md:py-16 px-6">
      <div className="max-w-5xl mx-auto bg-surface-elevated rounded-2xl py-10 px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={isInView || reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{
                duration: reducedMotion ? 0 : 0.2,
                delay: reducedMotion ? 0 : i * 0.035,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="font-serif text-3xl md:text-4xl text-primary tracking-[-0.03em] mb-1">
                {stat.value}
              </div>
              <div className="text-text-secondary text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
