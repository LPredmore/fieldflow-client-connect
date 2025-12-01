import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { canManageUsers, UserRole } from "@/utils/roleUtils";
import BusinessSettings from "@/components/Settings/BusinessSettings";
import UserManagement from "@/components/Settings/UserManagement";
import ClinicalSettings from "@/components/Settings/ClinicalSettings";
import { 
  Building, 
  Users,
  Stethoscope
} from "lucide-react";

const settingsCategories = [
  { 
    id: 'business', 
    name: 'Business Profile', 
    icon: Building,
    description: 'Company information and branding'
  },
  { 
    id: 'clinical', 
    name: 'Clinical Settings', 
    icon: Stethoscope,
    description: 'Practice fields and license types',
    adminOnly: true
  },
  { 
    id: 'users', 
    name: 'User Management', 
    icon: Users,
    description: 'Invite and manage team members',
    adminOnly: true
  }
];

export default function Settings() {
  const [activeCategory, setActiveCategory] = useState('business');
  const { userRole, isAdmin } = useAuth();

  const renderContent = () => {
    switch (activeCategory) {
      case 'business':
        return <BusinessSettings />;
      case 'clinical':
        return <ClinicalSettings />;
      case 'users':
        return <UserManagement />;
      default:
        return <BusinessSettings />;
    }
  };

  const visibleCategories = settingsCategories.filter(category => 
    !category.adminOnly || canManageUsers(userRole as UserRole, isAdmin)
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your business configuration and preferences</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-80">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration</CardTitle>
                <CardDescription>
                  Choose a category to configure your settings
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {visibleCategories.map((category) => {
                    const Icon = category.icon;
                    const isActive = activeCategory === category.id;
                    
                    return (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-accent",
                          isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{category.name}</div>
                          <div className={cn(
                            "text-sm mt-1",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {category.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}