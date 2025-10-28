import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MetricsCards from "@/components/dashboard/MetricsCards";
import AIContentGenerator from "@/components/dashboard/AIContentGenerator";
import RecentActivity from "@/components/dashboard/RecentActivity";
import SocialMediaManager from "@/components/dashboard/SocialMediaManager";
import PropertyListings from "@/components/dashboard/PropertyListings";
import SEOAnalytics from "@/components/dashboard/SEOAnalytics";
import ContentCalendar from "@/components/dashboard/ContentCalendar";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { isConnected, lastMessage } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage);
        
        switch (message.type) {
          case 'ai_content_generated':
            toast({
              title: "AI Content Generated!",
              description: `New ${message.data.contentType.replace('_', ' ')} content has been created.`,
            });
            break;
          case 'social_post_created':
            toast({
              title: message.data.success ? "Posted Successfully!" : "Post Failed",
              description: message.data.success 
                ? `Content posted to ${message.data.platforms.join(', ')}`
                : "Some platforms failed to receive the post",
              variant: message.data.success ? "default" : "destructive"
            });
            break;
          case 'new_lead':
            toast({
              title: "New Lead Received!",
              description: message.data.source ? `Lead from ${message.data.source}` : "New potential client inquiry",
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" data-testid="dashboard-container">
      {/* Sidebar */}
      <Sidebar user={user} />
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header 
          title="Dashboard Overview" 
          user={user}
        />
        
        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Connection Status Indicator */}
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
              Real-time updates disconnected. Attempting to reconnect...
            </div>
          )}
          
          {/* Metrics Cards */}
          <MetricsCards />
          
          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Content Generator - spans 2 columns */}
            <AIContentGenerator />
            
            {/* Recent Activity */}
            <RecentActivity />
          </div>
          
          {/* Social Media Dashboard */}
          <SocialMediaManager />
          
          {/* Property Listings & SEO Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PropertyListings />
            <SEOAnalytics />
          </div>
          
          {/* Content Calendar */}
          <ContentCalendar />
        </div>
      </main>
    </div>
  );
}
