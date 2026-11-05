import { ExternalLink, RefreshCw } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button, Card, PageHeader } from '../components/ui'

export default function Architecture() {
  const iframeRef = useRef(null)
  const [loading, setLoading] = useState(true)

  function reload() {
    setLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = '/architecture.html'
    }
  }

  return (
    <>
      <PageHeader
        title="System Architecture"
        subtitle="Interactive Archify diagram: full-stack component topology, live trace motion, and source verification"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={reload} aria-label="Refresh diagram">
              <RefreshCw size={14} /> Refresh
            </Button>
            <Button
              onClick={() => window.open('/architecture.html', '_blank')}
            >
              <ExternalLink size={14} /> Open full screen
            </Button>
          </div>
        }
      />

      <Card className="relative overflow-hidden border border-ink-200 shadow-sm dark:border-[#222220]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs dark:bg-[#111110]/70">
            <p className="font-mono text-xs text-ink-500">Loading interactive architecture...</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/architecture.html"
          title="FinWise Interactive Architecture"
          onLoad={() => setLoading(false)}
          className="h-[750px] w-full border-0 bg-[#F8F7F4] dark:bg-[#0A0A09]"
        />
      </Card>
    </>
  )
}
