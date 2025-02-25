'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';

export function ReasoningTraces({ traces }: { traces: string[] }) {
  if (traces.length === 0) return null;
  
  return (
    <div className="mt-4 mb-6">
      <h3 className="text-sm font-medium mb-3">AI Reasoning Process</h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {traces.map((trace, i) => (
          <Card key={i} className="overflow-hidden bg-muted/30">
            <CardContent className="p-3">
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Step {i + 1}</Badge>
                <span className="text-xs text-muted-foreground">Reasoning trace</span>
              </div>
              <div className="mt-2 text-sm whitespace-pre-wrap">{trace}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 