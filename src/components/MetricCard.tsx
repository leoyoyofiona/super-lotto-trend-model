import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone?: 'red' | 'blue' | 'green' | 'amber' | 'slate'
}

export function MetricCard({ icon: Icon, label, value, detail, tone = 'slate' }: MetricCardProps) {
  return (
    <article className={clsx('metric-card', `metric-card--${tone}`)}>
      <div className="metric-icon" aria-hidden="true">
        <Icon size={21} strokeWidth={2.2} />
      </div>
      <div>
        <p className="metric-label">{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}
