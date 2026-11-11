import type { ReactNode } from 'react'
import { PageHeader } from '../layout/PageLayout'

export function ResultsLayout({ summary, changeAction, map, children }: { summary?: string; changeAction: ReactNode; map: ReactNode; children: ReactNode }) {
  return <div className="results-screen"><PageHeader title="検索結果" description={summary} action={changeAction} /><div className="search-map">{map}</div><section className="results-sheet"><div className="sheet-grabber" aria-hidden="true" />{children}</section></div>
}
