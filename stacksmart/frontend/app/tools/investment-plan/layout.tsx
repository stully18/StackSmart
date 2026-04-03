import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Investment Plan Builder',
  description:
    'Get a personalized ETF portfolio based on your risk tolerance and goals. See 10, 20, and 30-year projections with actionable next steps.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
