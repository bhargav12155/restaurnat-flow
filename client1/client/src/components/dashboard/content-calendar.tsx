import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

export function ContentCalendar() {
  const events = [
    {
      title: "Open House - Benson Property",
      date: "Today",
      time: "2:00 PM",
      type: "event",
      status: "scheduled"
    },
    {
      title: "Social Media - Market Update",
      date: "Tomorrow", 
      time: "9:00 AM",
      type: "social",
      status: "draft"
    },
    {
      title: "Blog Post - Dundee Market Analysis",
      date: "Dec 30",
      time: "10:00 AM", 
      type: "blog",
      status: "scheduled"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="mr-2 h-5 w-5" />
          Content Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-sm font-medium">{event.title}</h4>
                  <Badge variant="outline">{event.type}</Badge>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  {event.date} at {event.time}
                </div>
              </div>
              <Badge variant={event.status === "scheduled" ? "default" : "secondary"}>
                {event.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}