'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'

export default function CTASection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px', amount: 0 })
  const { user, isLoading } = useAuth()

  return (
    <section ref={ref} className="py-16 md:py-20 px-6 relative overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(190,255,0,0.05) 0%, transparent 70%)',
        }}
      />

      <motion.div
        className="relative z-10 max-w-2xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="font-serif text-4xl md:text-5xl text-text-primary tracking-[-0.03em] mb-4">
          Start Building Your Financial Future
        </h2>
        <p className="text-text-secondary text-lg leading-[1.7] mb-8">
          Four free tools. No spreadsheets. No financial jargon. Just clarity.
        </p>
        {!isLoading && (
          <Link
            href={user ? '/tools' : '/auth/signup'}
            className="btn-gradient text-lg px-10 py-4 inline-block"
          >
            {user ? 'Continue to Tools' : 'Create Free Account'}
          </Link>
        )}
      </motion.div>
    </section>
  )
}
