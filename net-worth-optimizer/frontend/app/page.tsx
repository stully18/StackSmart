'use client'

import HeroSection from './components/landing/HeroSection'
import DashboardPreview from './components/landing/DashboardPreview'
import FeaturesSection from './components/landing/FeaturesSection'
import StatsSection from './components/landing/StatsSection'
import CTASection from './components/landing/CTASection'
import Footer from './components/landing/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <DashboardPreview />
      <FeaturesSection />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  )
}
