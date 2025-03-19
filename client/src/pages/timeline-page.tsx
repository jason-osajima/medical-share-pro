import { useQuery } from "@tanstack/react-query";
import { Appointment } from "@shared/schema";
import NavBar from "@/components/nav-bar";
import AppointmentForm from "@/components/appointment-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  FileText, 
  ChevronDown,
  ChevronUp,
  Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TimelineItemProps = {
  appointment: Appointment;
  isExpanded: boolean;
  onToggle: () => void;
};

function TimelineItem({ appointment, isExpanded, onToggle }: TimelineItemProps) {
  const formattedDate = format(new Date(appointment.date), "MMM d, yyyy");
  const formattedTime = format(new Date(appointment.date), "h:mm a");

  return (
    <div className="relative pl-8 pb-8">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
      
      {/* Timeline dot */}
      <div className="absolute left-[-8px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white" />

      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">{appointment.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                {formattedDate}
                <Clock className="h-4 w-4 ml-2" />
                {formattedTime}
              </div>
              {appointment.location && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  {appointment.location}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-gray-500"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div
            className={cn(
              "mt-4 space-y-4 overflow-hidden transition-all",
              isExpanded ? "block" : "hidden"
            )}
          >
            {appointment.notes && (
              <div className="text-sm text-gray-600">{appointment.notes}</div>
            )}

            {appointment.documentIds && appointment.documentIds.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Attached Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {appointment.documentIds.map((docId) => (
                    <div
                      key={docId}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      Document #{docId}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TimelinePage() {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Appointment Timeline</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Appointment</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <AppointmentForm />
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !appointments?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No appointments scheduled yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-0">
              {appointments
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((appointment) => (
                  <TimelineItem
                    key={appointment.id}
                    appointment={appointment}
                    isExpanded={expandedIds.has(appointment.id)}
                    onToggle={() => toggleExpanded(appointment.id)}
                  />
                ))}
            </div>
          )}
        </ScrollArea>
      </main>
    </div>
  );
}
