import { Card, SectionLabel, LoadingRow, MD } from './UI.jsx'

export default function BugAnalysis({ report, loading }) {
  return (
    <Card className="fade-up">
      <SectionLabel>AI Code Analysis &amp; Bug Detection</SectionLabel>
      {loading && !report && <LoadingRow label="Scanning for issues…" />}
      {report && (
        <div className={loading ? 'cursor' : ''}>
          <MD text={report} />
        </div>
      )}
    </Card>
  )
}
