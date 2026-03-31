'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden px-6">
      {/* Radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(190,255,0,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h1
          className="font-serif text-5xl md:text-7xl leading-tight tracking-[-0.03em] text-text-primary mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          Build <span className="text-primary">Wealth</span> While You&rsquo;re Young
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-text-secondary leading-[1.7] max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          Smart financial tools designed for college students and new graduates.
          Optimize debt, maximize retirement savings, and build your investment portfolio.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="/auth/signup"
            className="btn-gradient px-8 py-4 text-lg"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="btn-ghost px-8 py-4 text-lg"
          >
            Sign In
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
