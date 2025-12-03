import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Library, PencilRuler } from "lucide-react";
import { FormLibrary } from "@/components/Forms/FormLibrary/FormLibrary";
import { FormBuilder } from "@/components/Forms/FormBuilder/FormBuilder";

export default function Forms() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage custom forms for your practice
          </p>
        </div>
      </div>

      <Tabs defaultValue="library" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Form Library
          </TabsTrigger>
          <TabsTrigger value="creator" className="flex items-center gap-2">
            <PencilRuler className="h-4 w-4" />
            Form Creator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <FormLibrary />
        </TabsContent>

        <TabsContent value="creator" className="space-y-4">
          <FormBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
