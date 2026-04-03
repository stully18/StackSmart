import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Debt Optimizer',
  description:
    'Compare paying off debt vs investing. Add your loans, enter your monthly budget, and get a data-driven recommendation based on real market returns.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
