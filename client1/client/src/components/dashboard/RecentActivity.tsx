import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Share2, Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { UserActivity } from "@shared/schema";

const activityIcons = {
  ai_content_generated: { icon: Bot, color: 'text-primary', bgColor: 'bg-primary/10' },
  social_post_created: { icon: Share2, color: 'text-secondary', bgColor: 'bg-secondary/10' },
  property_created: { icon: Plus, color: 'text-accent', bgColor: 'bg-accent/10' },
  seo_analysis_performed: { icon: Search, color: 'text-green-500', bgColor: 'bg-green-500/10' },
};

export default function RecentActivity() {
  const { data: activities, isLoading } = useQuery<UserActivity[]>({
    queryKey: ['/api/activity'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityDisplay = (activity: UserActivity) => {
    const config = activityIcons[activity.action as keyof typeof activityIcons] || {
      icon: Plus,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted'
    };

    return {
      ...config,
      title: activity.description || activity.action,
      subtitle: activity.metadata ? 
        (typeof activity.metadata === 'object' && activity.metadata !== null ?
          Object.entries(activity.metadata).map(([key, value]) => 
            `${key}: ${value}`
          ).join(', ') : 
          String(activity.metadata)
        ) : '',
      time: activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : 'Unknown time'
    };
  };

  // Mock data when no activities are found
  const mockActivities = [
    {
      id: '1',
      action: 'ai_content_generated',
      description: 'AI Content Generated',
      metadata: { contentType: 'social_post' },
      createdAt: new Date(Date.now() - 2 * 60 * 1000)
    },
    {
      id: '2', 
      action: 'social_post_created',
      description: 'Posted to Instagram',
      metadata: { platform: 'instagram' },
      createdAt: new Date(Date.now() - 15 * 60 * 1000)
    },
    {
      id: '3',
      action: 'property_created',
      description: 'New Property Added',
      metadata: { address: '123 Maple St, Midtown' },
      createdAt: new Date(Date.now() - 60 * 60 * 1000)
    },
    {
      id: '4',
      action: 'seo_analysis_performed',
      description: 'SEO Report Generated', 
      metadata: { score: 92 },
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
    }
  ];

  const displayActivities = activities && activities.length > 0 ? activities : mockActivities;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {displayActivities.slice(0, 6).map((activity) => {
            const display = getActivityDisplay(activity);
            const Icon = display.icon;
            
            return (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${display.bgColor} rounded-full flex items-center justify-center`}>
                  <Icon className={`${display.color} w-4 h-4`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{display.title}</p>
                  {display.subtitle && (
                    <p className="text-xs text-muted-foreground">{display.subtitle}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{display.time}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full mt-4 text-primary hover:text-primary/80 text-sm font-medium"
        >
          View All Activity
        </Button>
      </CardContent>
    </Card>
  );
}
