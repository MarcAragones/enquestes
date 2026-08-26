import { SurveyCard } from './SurveyCard'
import type { EnquestaIndexEntry } from '../types/enquesta'

interface SurveyGridProps {
  enquestes: EnquestaIndexEntry[]
  onSelect: (id: string) => void
}

/** Responsive grid of survey cards: one column on mobile, two at tablet, three on desktop. */
export function SurveyGrid({ enquestes, onSelect }: SurveyGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {enquestes.map((enquesta) => (
        <SurveyCard key={enquesta.id} enquesta={enquesta} onSelect={onSelect} />
      ))}
    </div>
  )
}
