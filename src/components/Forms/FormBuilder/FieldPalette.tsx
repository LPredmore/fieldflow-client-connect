import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_TYPE_CONFIGS, FIELD_TYPES } from '../constants';
import { FieldType } from '../types';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface FieldPaletteProps {
  onAddField: (type: FieldType) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFieldTypes = FIELD_TYPES.filter((type) => {
    const config = FIELD_TYPE_CONFIGS[type];
    const searchLower = searchQuery.toLowerCase();
    return (
      config.label.toLowerCase().includes(searchLower) ||
      config.description.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Field Types</CardTitle>
        <CardDescription>Click to add a field</CardDescription>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filteredFieldTypes.map((type) => {
          const config = FIELD_TYPE_CONFIGS[type];
          const Icon = config.icon;

          return (
            <Button
              key={type}
              variant="outline"
              className="w-full justify-start h-auto py-3 px-3"
              onClick={() => onAddField(type)}
            >
              <div className="flex items-start gap-3 text-left">
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{config.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
        
        {filteredFieldTypes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No fields found matching "{searchQuery}"
          </div>
        )}
      </CardContent>
    </Card>
  );
}
