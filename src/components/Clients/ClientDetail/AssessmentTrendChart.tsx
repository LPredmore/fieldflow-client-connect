import { useMemo, useState } from 'react';
import { subDays, format, isAfter } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';

export type DateRange = '30d' | '90d' | '180d' | '1y' | 'all';

interface Threshold {
  value: number;
  label: string;
  color: string;
}

interface AssessmentTrendChartProps {
  data: Array<{ date: string; score: number }>;
  maxScore: number;
  label: string;
  thresholds?: Threshold[];
}

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '180d', label: '180 Days' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All' },
];

const getDaysFromRange = (range: DateRange): number | null => {
  switch (range) {
    case '30d': return 30;
    case '90d': return 90;
    case '180d': return 180;
    case '1y': return 365;
    case 'all': return null;
  }
};

export function AssessmentTrendChart({
  data,
  maxScore,
  label,
  thresholds = [],
}: AssessmentTrendChartProps) {
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const filteredData = useMemo(() => {
    // Sort data ascending by date for chart display
    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const days = getDaysFromRange(dateRange);
    if (days === null) return sortedData;

    const cutoffDate = subDays(new Date(), days);
    return sortedData.filter((d) => isAfter(new Date(d.date), cutoffDate));
  }, [data, dateRange]);

  const formatXAxis = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  const formatTooltipDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No assessment data to display
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={dateRange === option.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDateRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No assessments in the selected time period
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {DATE_RANGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={dateRange === option.value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDateRange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={filteredData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            domain={[0, maxScore]}
            className="text-xs"
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            labelFormatter={formatTooltipDate}
            formatter={(value: number) => [value, label]}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          {thresholds.map((threshold) => (
            <ReferenceLine
              key={threshold.value}
              y={threshold.value}
              stroke={threshold.color}
              strokeDasharray="5 5"
              label={{
                value: threshold.label,
                position: 'right',
                fill: threshold.color,
                fontSize: 10,
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {thresholds.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          {thresholds.map((threshold) => (
            <div key={threshold.value} className="flex items-center gap-1">
              <div
                className="w-4 h-0.5"
                style={{ backgroundColor: threshold.color }}
              />
              <span>{threshold.label} ({threshold.value})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
