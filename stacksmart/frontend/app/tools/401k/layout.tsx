import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '401(k) Calculator',
  description:
    'Calculate your 401(k) growth with employer matching. See exactly how much free money you may be leaving on the table and project your retirement savings.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
