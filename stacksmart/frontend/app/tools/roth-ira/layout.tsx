import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Roth IRA Planner',
  description:
    'See the power of starting a Roth IRA in college. Model tax-free growth and discover why starting early can mean hundreds of thousands more in retirement.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
