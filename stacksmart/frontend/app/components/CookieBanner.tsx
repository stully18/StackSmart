'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const COOKIE_CONSENT_KEY = 'stacksmart-cookie-consent'

export default function CookieBanner() {
  const [hasConsent, setHasConsent] = useState(true)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)

    if (consent) {
      setHasConsent(true)
      return
    }

    setHasConsent(false)
    const timer = window.setTimeout(() => setIsVisible(true), 10)

    return () => window.clearTimeout(timer)
  }, [])

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    setHasConsent(true)
  }

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'false')
    setHasConsent(true)
  }

  if (hasConsent) {
    return null
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface transition-transform transition-opacity duration-300 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-6 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-text-muted sm:max-w-[78%]">
          We use analytics to improve StackSmart. No personal data is sold.{' '}
          <Link href="/privacy" className="text-text-secondary hover:text-primary">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDecline}
            className="px-5 py-2 text-sm font-medium text-text-muted hover:text-text-secondary border border-border-subtle rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="btn-gradient px-5 py-2 text-sm font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
