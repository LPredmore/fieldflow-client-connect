import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface AdminSettingsProps {
  isAdmin: boolean;
  onChange: (isAdmin: boolean) => void;
}

export function AdminSettings({ isAdmin, onChange }: AdminSettingsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Administrator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="admin-toggle">Administrator Access</Label>
            <div className="text-sm text-muted-foreground">
              Grant full system access and user management permissions
            </div>
          </div>
          <Switch
            id="admin-toggle"
            checked={isAdmin}
            onCheckedChange={onChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
