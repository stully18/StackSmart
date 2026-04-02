'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import HeroSection from './components/landing/HeroSection'
import FeaturesSection from './components/landing/FeaturesSection'
import StatsSection from './components/landing/StatsSection'
import CTASection from './components/landing/CTASection'
import Footer from './components/landing/Footer'
import { useAuth } from './context/AuthContext'

export default function Home() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/tools')
    }
  }, [isLoading, user, router])

  if (!isLoading && user) {
    return null
  }

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <motion.div
          aria-hidden="true"
          className="absolute top-[10vh] left-1/2 h-[44rem] w-[44rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(190,255,0,0.13) 0%, rgba(190,255,0,0.06) 40%, transparent 72%)',
            mixBlendMode: 'screen',
          }}
          animate={{ x: [-12, 14, -10, -12], y: [0, -12, 8, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute top-[26vh] right-[-14rem] h-[34rem] w-[34rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0,212,170,0.1) 0%, rgba(0,212,170,0.04) 48%, transparent 74%)',
            mixBlendMode: 'screen',
          }}
          animate={{ x: [0, -16, 12, 0], y: [0, 10, -8, 0] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10">
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <CTASection />
      <Footer />
      </div>
    </div>
  )
}
