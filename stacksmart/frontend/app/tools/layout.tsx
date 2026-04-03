import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Financial Tools',
    template: '%s — StackSmart',
  },
  description:
    'Free financial tools for college students and early-career professionals — debt optimizer, 401(k) calculator, Roth IRA planner, and investment plan builder.',
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children
}
