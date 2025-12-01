import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, UserPlus, ClipboardList, FileSignature } from "lucide-react";
import { FormBuilder } from "@/components/Forms/FormBuilder/FormBuilder";
import { IntakeFormsManager } from "@/components/Forms/IntakeForms/IntakeFormsManager";
import { SessionNotesManager } from "@/components/Forms/SessionNotes/SessionNotesManager";

export default function Forms() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage custom forms for client sign-up, intake, and session notes
          </p>
        </div>
      </div>

      <Tabs defaultValue="signup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="signup" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Sign-Up Forms
          </TabsTrigger>
          <TabsTrigger value="intake" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Intake Forms
          </TabsTrigger>
          <TabsTrigger value="session" className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Session Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signup" className="space-y-4">
          <FormBuilder formType="signup" />
        </TabsContent>

        <TabsContent value="intake" className="space-y-4">
          <IntakeFormsManager />
        </TabsContent>

        <TabsContent value="session" className="space-y-4">
          <SessionNotesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
