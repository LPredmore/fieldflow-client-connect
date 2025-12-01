import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export function DocumentsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Documents</h2>
        <p className="text-muted-foreground">
          View and download your medical documents
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No documents available</p>
            <p className="text-sm mt-2">Documents shared with you will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
