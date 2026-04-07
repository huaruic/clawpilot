import React from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export function MemoryPage(): React.ReactElement {
  return (
    <div className="cp-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Memory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Persistent memory UI is planned for a follow-up release.</p>
        </div>
        <Badge variant="secondary">Phase 2+</Badge>
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Roadmap Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Memory namespaces and retention controls</li>
            <li>Search and prune across conversation sessions</li>
            <li>Per-agent memory policy visibility</li>
          </ul>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled>Open Memory Store</Button>
            <Button variant="outline" size="sm" disabled>Import Snapshot</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
