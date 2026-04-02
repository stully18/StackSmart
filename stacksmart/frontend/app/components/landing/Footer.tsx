import Link from 'next/link'
import { Layers } from 'lucide-react'

const links = {
  Product: [
    { label: 'Tools', href: '#' },
    { label: 'Pricing', href: '#' },
    { label: 'FAQ', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Logo */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={22} className="text-primary" />
              <span className="text-text-primary font-semibold text-lg">StackSmart</span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="text-text-primary font-semibold text-sm mb-4">{heading}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-text-muted text-sm hover:text-text-secondary transition-colors duration-200"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border-subtle pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            &copy; 2026 StackSmart. All rights reserved.
          </p>
          <p className="text-text-muted/70 text-xs text-center md:text-right">
            Not financial advice. Consult a professional for personalized guidance.
          </p>
        </div>
      </div>
    </footer>
  )
}
