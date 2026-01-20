import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Printer, X } from 'lucide-react';
import { useSessionNotePrintData } from '@/hooks/useSessionNotePrintData';
import { SessionNotePrintView } from './SessionNotePrintView';

interface SessionNotePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string | null;
  clientId: string | null;
}

export function SessionNotePrintDialog({
  open,
  onOpenChange,
  noteId,
  clientId,
}: SessionNotePrintDialogProps) {
  const printContainerRef = useRef<HTMLDivElement>(null);
  
  const { printData, loading, error } = useSessionNotePrintData({
    noteId: open ? noteId : null,
    clientId: open ? clientId : null,
  });

  const handlePrint = () => {
    if (!printContainerRef.current) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups to print the document.');
      return;
    }

    // Get the print content
    const printContent = printContainerRef.current.innerHTML;

    // Write the print document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Session Note - Print</title>
          <style>
            @page {
              size: letter;
              margin: 0.5in;
            }
            
            * {
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 11pt;
              line-height: 1.4;
              color: black;
              background: white;
              margin: 0;
              padding: 0;
            }
            
            .session-note-print {
              max-width: 7.5in;
              margin: 0 auto;
            }
            
            .letterhead {
              border-bottom: 2px solid black;
              padding-bottom: 12pt;
              margin-bottom: 18pt;
            }
            
            .letterhead h1 {
              font-size: 16pt;
              font-weight: bold;
              margin: 0 0 4pt 0;
            }
            
            .letterhead p {
              font-size: 10pt;
              margin: 2pt 0;
            }
            
            .letterhead img {
              max-height: 48pt;
              width: auto;
            }
            
            .section {
              margin-bottom: 12pt;
              page-break-inside: avoid;
              border: 1px solid #ccc;
              padding: 8pt;
            }
            
            .section-title {
              font-weight: bold;
              font-size: 10pt;
              text-transform: uppercase;
              border-bottom: 1px solid #ccc;
              padding-bottom: 4pt;
              margin-bottom: 8pt;
            }
            
            .grid {
              display: grid;
              gap: 4pt 16pt;
            }
            
            .grid-cols-2 {
              grid-template-columns: repeat(2, 1fr);
            }
            
            .grid-cols-3 {
              grid-template-columns: repeat(3, 1fr);
            }
            
            .col-span-2 {
              grid-column: span 2;
            }
            
            .signature-area {
              margin-top: 36pt;
              page-break-inside: avoid;
            }
            
            .signature-line {
              border-bottom: 1px solid black;
              height: 24pt;
              margin-bottom: 4pt;
            }
            
            footer {
              margin-top: 36pt;
              padding-top: 8pt;
              border-top: 1px solid #ccc;
              text-align: center;
              font-size: 9pt;
              color: #666;
            }
            
            .flex {
              display: flex;
            }
            
            .justify-between {
              justify-content: space-between;
            }
            
            .items-start {
              align-items: flex-start;
            }
            
            .items-center {
              align-items: center;
            }
            
            .gap-4 {
              gap: 12pt;
            }
            
            .gap-16 {
              gap: 48pt;
            }
            
            .text-center {
              text-align: center;
            }
            
            .text-sm {
              font-size: 10pt;
            }
            
            .text-xs {
              font-size: 9pt;
            }
            
            .text-lg {
              font-size: 12pt;
            }
            
            .text-xl {
              font-size: 14pt;
            }
            
            .text-2xl {
              font-size: 16pt;
            }
            
            .font-bold {
              font-weight: bold;
            }
            
            .font-semibold {
              font-weight: 600;
            }
            
            .uppercase {
              text-transform: uppercase;
            }
            
            .tracking-wide {
              letter-spacing: 0.05em;
            }
            
            .mb-1 { margin-bottom: 4pt; }
            .mb-3 { margin-bottom: 8pt; }
            .mb-6 { margin-bottom: 16pt; }
            .mt-12 { margin-top: 36pt; }
            .pt-4 { padding-top: 8pt; }
            .pt-8 { padding-top: 16pt; }
            .pb-1 { padding-bottom: 4pt; }
            .pb-4 { padding-bottom: 8pt; }
            .p-4 { padding: 8pt; }
            .p-8 { padding: 16pt; }
            
            .space-y-1 > * + * { margin-top: 4pt; }
            .space-y-2 > * + * { margin-top: 8pt; }
            .gap-y-2 { row-gap: 8pt; }
            .gap-x-8 { column-gap: 24pt; }
            
            .border { border: 1px solid #ccc; }
            .border-b { border-bottom: 1px solid #ccc; }
            .border-b-2 { border-bottom: 2px solid black; }
            .border-t { border-top: 1px solid #ccc; }
            .border-black { border-color: black; }
            .border-gray-300 { border-color: #d1d5db; }
            
            .text-gray-500 { color: #6b7280; }
            .text-gray-600 { color: #4b5563; }
            
            .whitespace-pre-wrap { white-space: pre-wrap; }
            
            .list-decimal { list-style-type: decimal; }
            .list-inside { list-style-position: inside; }
            
            .h-8 { height: 24pt; }
            .h-16 { height: 48pt; }
            .w-auto { width: auto; }
            
            .object-contain { object-fit: contain; }
            
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for images to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Print Session Note</DialogTitle>
              <DialogDescription>
                Preview and print the session note document
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} disabled={loading || !!error}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading print data...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64 text-destructive">
              <p>Error loading print data. Please try again.</p>
            </div>
          )}

          {!loading && !error && printData && (
            <div 
              ref={printContainerRef}
              className="border rounded-lg bg-white shadow-sm"
            >
              <SessionNotePrintView data={printData} />
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
