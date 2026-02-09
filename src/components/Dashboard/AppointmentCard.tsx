import { Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppointmentCardProps {
  id: string;
  clientName: string;
  /** Pre-formatted display date from database (e.g., "Saturday, December 20, 2025") */
  displayDate?: string;
  /** Pre-formatted display time from database (e.g., "4:00 PM") */
  displayTime?: string;
  /** @deprecated Use displayDate and displayTime instead. Kept for backward compatibility. */
  startAt?: string;
  isTelehealth: boolean;
  /** Daily.co room URL for telehealth appointments */
  videoroomUrl?: string | null;
  showDocumentButton?: boolean;
  onDocumentClick?: (id: string) => void;
}

/**
 * Formats a UTC timestamp for display when pre-formatted strings aren't available.
 * This is a fallback for backward compatibility - prefer using displayDate/displayTime props.
 */
function formatFallback(startAt: string): { date: string; time: string } {
  try {
    const date = new Date(startAt);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
    };
  } catch {
    return { date: '', time: '' };
  }
}

const AppointmentCard = ({
  id,
  clientName,
  displayDate,
  displayTime,
  startAt,
  isTelehealth,
  videoroomUrl,
  showDocumentButton = false,
  onDocumentClick,
}: AppointmentCardProps) => {
  // Use pre-formatted strings from database, fall back to local formatting if not available
  const fallback = startAt && !displayDate ? formatFallback(startAt) : null;
  const formattedDate = displayDate || fallback?.date || '';
  const formattedTime = displayTime || fallback?.time || '';

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{clientName}</p>
          <p className="text-xs text-muted-foreground">
            {formattedDate} • {formattedTime}
          </p>
        </div>
        {isTelehealth && (
          <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">
            <Video className="h-3 w-3" />
            <span>Telehealth</span>
          </div>
        )}
      </div>
      {isTelehealth && videoroomUrl && (
        <Button
          size="sm"
          asChild
          className="w-full"
        >
          <a href={videoroomUrl} target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4 mr-2" />
            Start Session
          </a>
        </Button>
      )}
      {showDocumentButton && onDocumentClick && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onDocumentClick(id)}
        >
          <FileText className="h-4 w-4 mr-2" />
          Document Session
        </Button>
      )}
    </div>
  );
};

export default AppointmentCard;
