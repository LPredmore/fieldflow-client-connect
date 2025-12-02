import { Users, Activity, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ClientStatsCardsProps {
  stats: {
    total: number;
    active: number;
    new: number;
  };
}

export function ClientStatsCards({ stats }: ClientStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="shadow-material-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.total}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-material-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Patients</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.active}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-material-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">New Patients</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.new}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
