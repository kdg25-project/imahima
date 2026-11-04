import type { ReactNode } from 'react'

export function PageLayout({ children }: { children: ReactNode }) {
  return <div className="page-layout">{children}</div>
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div className="page-header__text"><h1>{title}</h1>{description && <p className="text-muted">{description}</p>}</div>{action && <div className="page-header__action">{action}</div>}</header>
}
