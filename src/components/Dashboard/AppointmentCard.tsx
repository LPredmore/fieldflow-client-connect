import { Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface AppointmentCardProps {
  id: string;
  clientName: string;
  startAt: string;
  isTelehealth: boolean;
  showDocumentButton?: boolean;
  onDocumentClick?: (id: string) => void;
}

const AppointmentCard = ({
  id,
  clientName,
  startAt,
  isTelehealth,
  showDocumentButton = false,
  onDocumentClick,
}: AppointmentCardProps) => {
  const appointmentDate = new Date(startAt);
  const formattedDate = format(appointmentDate, "MMM d, yyyy");
  const formattedTime = format(appointmentDate, "h:mm a");

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{clientName}</p>
          <p className="text-xs text-muted-foreground">
            {formattedDate} • {formattedTime}
          </p>
        </div>
        {isTelehealth && (
          <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
            <Video className="h-3 w-3" />
            <span>Telehealth</span>
          </div>
        )}
      </div>
      {showDocumentButton && onDocumentClick && (
        <Button
          size="sm"
          variant="outline"
          className="ml-3 shrink-0"
          onClick={() => onDocumentClick(id)}
        >
          <FileText className="h-3 w-3 mr-1" />
          Document Session
        </Button>
      )}
    </div>
  );
};

export default AppointmentCard;
