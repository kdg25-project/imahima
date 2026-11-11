import { useId } from 'react'
import type { CSSProperties } from 'react'

// Only display positions/labels. The screen owns any conversion to API duration.
export function TimeRange({ labels, value, onChange, label = '空き時間' }: {
  labels: readonly string[]
  value: number
  onChange: (value: number) => void
  label?: string
}) {
  const id = useId()
  const progress = labels.length > 1 ? value / (labels.length - 1) * 100 : 0
  return (
    <div className="time-range" style={{ '--progress': `${progress}%` } as CSSProperties}>
      <div className="time-range__output-row"><output htmlFor={id}>{labels[value]}</output></div>
      <input id={id} type="range" aria-label={label} aria-valuetext={labels[value]} min={0} max={Math.max(0, labels.length - 1)} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="time-range__marks" aria-hidden="true">{labels.map((mark, index) => <span key={mark} className={index === value ? 'is-selected' : ''}>{mark}</span>)}</div>
    </div>
  )
}
