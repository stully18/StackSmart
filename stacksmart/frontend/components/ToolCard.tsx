'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';

interface ToolCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  gradientFrom?: string;
  gradientTo?: string;
  borderColor?: string;
}

export default function ToolCard({
  href,
  icon,
  title,
  description,
  features,
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group block bg-surface border border-border-subtle rounded-xl p-6 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(190,255,0,0.06)] hover:scale-[1.02] transition-transform duration-300"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-white transition-colors">
        {title}
      </h3>
      <p className="text-text-secondary text-sm mb-4">{description}</p>
      <ul className="space-y-1.5">
        {features.map((feature, idx) => (
          <li key={idx} className="text-xs text-text-muted flex items-center gap-2">
            <Check size={12} className="text-primary" />
            {feature}
          </li>
        ))}
      </ul>
    </Link>
  );
}
