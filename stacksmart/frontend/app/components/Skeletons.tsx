'use client'

export function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="bg-surface border border-border-subtle rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-surface-elevated rounded w-3/4 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-surface-elevated rounded w-full" />
            <div className="h-4 bg-surface-elevated rounded w-5/6" />
            <div className="h-4 bg-surface-elevated rounded w-4/6" />
          </div>
        </div>
      ))}
    </>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 animate-pulse">
      <div className="h-6 bg-surface-elevated rounded w-1/3 mb-6" />
      <div className="w-full h-64 bg-surface-elevated rounded mb-4" />
      <div className="flex gap-4">
        <div className="flex-1 h-12 bg-surface-elevated rounded" />
        <div className="flex-1 h-12 bg-surface-elevated rounded" />
      </div>
    </div>
  )
}

export function SkeletonForm() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-4 bg-surface-elevated rounded w-1/4 mb-2" />
        <div className="h-10 bg-surface-elevated rounded" />
      </div>
      <div>
        <div className="h-4 bg-surface-elevated rounded w-1/4 mb-2" />
        <div className="h-10 bg-surface-elevated rounded" />
      </div>
      <div className="h-10 bg-surface-elevated rounded w-full" />
    </div>
  )
}
