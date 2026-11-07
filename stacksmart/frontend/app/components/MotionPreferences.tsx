'use client'

import { MotionConfig } from 'framer-motion'
import { useSyncExternalStore } from 'react'

const motionQuery = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(motionQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function snapshot() {
  return window.matchMedia(motionQuery).matches
}

/** React to preference changes without remounting forms or discarding input. */
export function useMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

export default function MotionPreferences({ children }: { children: React.ReactNode }) {
  const reducedMotion = useMotionPreference()
  return <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>{children}</MotionConfig>
}
