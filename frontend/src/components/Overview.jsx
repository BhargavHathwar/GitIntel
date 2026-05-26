import { Card, SectionLabel, LoadingRow, MD } from './UI.jsx'

export default function Overview({ summary, loading }) {
  return (
    <Card className="fade-up">
      <SectionLabel>AI Repository Summary</SectionLabel>
      {loading && !summary && <LoadingRow label="Generating AI analysis…" />}
      {summary && (
        <div className={loading ? 'cursor' : ''}>
          <MD text={summary} />
        </div>
      )}
    </Card>
  )
}
