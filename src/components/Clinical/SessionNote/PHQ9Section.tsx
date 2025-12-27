import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Activity } from 'lucide-react';

interface PHQ9Data {
  id: string;
  total_score: number;
  severity: string;
  ai_narrative?: string | null;
  administered_at: string;
}

interface PHQ9SectionProps {
  phq9Data: PHQ9Data | null;
  loading?: boolean;
}

// Helper function to interpret PHQ-9 scores
function getScoreInterpretation(score: number): string {
  if (score >= 0 && score <= 4) return "None-minimal depression";
  if (score >= 5 && score <= 9) return "Mild depression";
  if (score >= 10 && score <= 14) return "Moderate depression";
  if (score >= 15 && score <= 19) return "Moderately severe depression";
  if (score >= 20) return "Severe depression";
  return "Score interpretation unavailable";
}

// Get badge variant based on severity
function getSeverityVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 0 && score <= 4) return "secondary";
  if (score >= 5 && score <= 9) return "outline";
  if (score >= 10 && score <= 14) return "default";
  return "destructive";
}

export const PHQ9Section: React.FC<PHQ9SectionProps> = memo(({ phq9Data, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            PHQ-9 Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading assessment data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!phq9Data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            PHQ-9 Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No PHQ-9 assessment on file for this client.</p>
        </CardContent>
      </Card>
    );
  }

  const interpretation = getScoreInterpretation(phq9Data.total_score);
  const variant = getSeverityVariant(phq9Data.total_score);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          PHQ-9 Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score and Interpretation */}
        <div className="flex items-center gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Score</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">{phq9Data.total_score}</span>
              <Badge variant={variant}>{interpretation}</Badge>
            </div>
          </div>
          <div className="ml-auto text-right">
            <Label className="text-xs text-muted-foreground">Administered</Label>
            <p className="text-sm">{new Date(phq9Data.administered_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* AI Narrative (if available) */}
        {phq9Data.ai_narrative && (
          <div>
            <Label className="text-xs text-muted-foreground">AI Narrative</Label>
            <Textarea 
              className="min-h-[80px] mt-1 bg-muted/50" 
              value={phq9Data.ai_narrative} 
              readOnly
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

PHQ9Section.displayName = 'PHQ9Section';
