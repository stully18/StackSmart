'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type AuroraBackgroundProps = {
  children: ReactNode
  className?: string
}

export function AuroraBackground({ children, className = '' }: AuroraBackgroundProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          aria-hidden="true"
          className="absolute top-[14%] left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(190,255,0,0.15) 0%, rgba(190,255,0,0.07) 42%, transparent 72%)',
            mixBlendMode: 'screen',
          }}
          animate={{ x: [-10, 12, -6, -10], y: [0, -8, 5, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute -bottom-40 right-[-8rem] h-[30rem] w-[30rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0,212,170,0.11) 0%, rgba(0,212,170,0.04) 48%, transparent 74%)',
            mixBlendMode: 'screen',
          }}
          animate={{ x: [0, -12, 10, 0], y: [0, 8, -8, 0] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[22%] mx-auto h-56 w-[42rem] max-w-[90vw] rounded-full blur-2xl"
          style={{
            background:
              'linear-gradient(90deg, rgba(190,255,0,0.07) 0%, rgba(0,212,170,0.06) 52%, rgba(190,255,0,0.07) 100%)',
          }}
        />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  )
}
