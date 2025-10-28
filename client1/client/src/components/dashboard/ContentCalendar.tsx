import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  type: 'social_post' | 'blog_article' | 'video_upload' | 'meeting';
  date: Date;
  color: string;
}

const eventTypes = {
  social_post: { name: 'Social Post', color: 'bg-primary/20 text-primary' },
  blog_article: { name: 'Blog Article', color: 'bg-secondary/20 text-secondary' },
  video_upload: { name: 'Video Upload', color: 'bg-accent/20 text-accent' },
  meeting: { name: 'Meeting', color: 'bg-green-500/20 text-green-600' },
};

// Mock events for demonstration
const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Instagram Post',
    type: 'social_post',
    date: new Date(2024, 8, 26),
    color: 'bg-primary/20 text-primary'
  },
  {
    id: '2',
    title: 'Blog Article',
    type: 'blog_article', 
    date: new Date(2024, 8, 28),
    color: 'bg-secondary/20 text-secondary'
  },
  {
    id: '3',
    title: 'Video Upload',
    type: 'video_upload',
    date: new Date(2024, 8, 28),
    color: 'bg-accent/20 text-accent'
  },
  {
    id: '4',
    title: 'Facebook Post',
    type: 'social_post',
    date: new Date(2024, 8, 30),
    color: 'bg-primary/20 text-primary'
  },
];

export default function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date: Date) => {
    return mockEvents.filter(event => isSameDay(event.date, date));
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Pad the beginning of the month with empty cells
  const firstDayOfWeek = getDay(monthStart);
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Content Calendar</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant={view === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 ml-4">
              <Plus className="w-4 h-4 mr-1" />
              Add Event
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              >
                ←
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              >
                →
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {weekDays.map((day) => (
              <div key={day} className="text-center font-medium text-muted-foreground text-sm py-2">
                {day}
              </div>
            ))}
            
            {/* Padding cells for the first week */}
            {Array.from({ length: paddingDays }).map((_, index) => (
              <div key={`padding-${index}`} className="min-h-24 p-2" />
            ))}
            
            {/* Calendar Days */}
            {days.map((day) => {
              const dayEvents = getEventsForDate(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 p-2 border border-border rounded-lg ${
                    isToday ? 'bg-primary/5 border-primary' : 'bg-background'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    isToday ? 'text-primary' : 'text-foreground'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.map((event) => (
                      <Badge
                        key={event.id}
                        variant="secondary"
                        className={`text-xs px-2 py-1 rounded truncate ${event.color}`}
                      >
                        {event.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center space-x-4 pt-4 border-t">
            {Object.entries(eventTypes).map(([type, config]) => (
              <div key={type} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded ${config.color}`} />
                <span className="text-xs text-muted-foreground">{config.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
