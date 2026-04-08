import React from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export function OllamaPage(): React.ReactElement {
  return (
    <div className="cp-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ollama</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dedicated local-model management panel is planned for follow-up iteration.</p>
        </div>
        <Badge variant="secondary">Preview</Badge>
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Planned UX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Model install queue and progress timeline</li>
            <li>Per-model RAM usage and runtime health</li>
            <li>One-click set as default provider model</li>
          </ul>
          <div className="flex items-center gap-2">
            <Button className="btn-active-scale" variant="secondary" size="sm" disabled>Check Local Runtime</Button>
            <Button className="btn-active-scale" variant="outline" size="sm" disabled>Pull Recommended Model</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
