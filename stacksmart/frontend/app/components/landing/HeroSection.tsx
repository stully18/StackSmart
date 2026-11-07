'use client'

import { useMotionPreference } from '@/app/components/MotionPreferences'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'

export default function HeroSection() {
  const reducedMotion = useMotionPreference()
  const { user, isLoading } = useAuth()

  return (
    <section className="min-h-[80vh] md:min-h-[84vh] flex items-center justify-center relative px-6">
      <div className="max-w-3xl mx-auto text-center py-12 md:py-14">
        <motion.h1
          className="font-serif text-5xl md:text-7xl leading-tight tracking-[-0.03em] text-text-primary mb-6"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Build <span className="text-primary">Wealth</span> With Clarity
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-text-secondary leading-[1.7] max-w-2xl mx-auto mb-10"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.035, ease: [0.22, 1, 0.36, 1] }}
        >
          Planning tools for early-career professionals who need a clearer answer on debt,
          retirement contributions, and long-term investing.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {isLoading ? null : user ? (
            <>
              <Link href="/tools" className="btn-gradient px-8 py-4 text-lg">
                Open Tools
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/signup" className="btn-gradient px-8 py-4 text-lg">
                Get Started
              </Link>
              <Link href="/auth/login" className="btn-ghost px-8 py-4 text-lg">
                Sign In
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </section>
  )
}
