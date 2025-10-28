import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, Twitter, Youtube, Check, Calendar } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlatformMetrics {
  facebook: {
    followers: number;
    weeklyEngagement: number;
    posts: number;
  };
  instagram: {
    followers: number;
    weeklyEngagement: number;
    posts: number;
  };
  youtube: {
    subscribers: number;
    weeklyViews: number;
    videos: number;
  };
  twitter: {
    followers: number;
    weeklyEngagement: number;
    posts: number;
  };
}

const platforms = [
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  { id: 'twitter', name: 'Twitter', icon: Twitter, color: 'text-gray-600', bgColor: 'bg-gray-50' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
];

export default function SocialMediaManager() {
  const [content, setContent] = useState(`🏡 JUST LISTED! Beautiful 3BR/2BA home in the heart of Benson! This charming property features updated kitchen, hardwood floors, and a spacious backyard perfect for entertaining. 

#OmahaRealEstate #BensonNeighborhood #JustListed #DreamHome`);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook', 'instagram']);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: metrics } = useQuery<PlatformMetrics>({
    queryKey: ['/api/social/metrics'],
  });

  const postMutation = useMutation({
    mutationFn: async (data: { content: string; platforms: string[] }) => {
      const response = await apiRequest('POST', '/api/social/post', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Posted Successfully!",
        description: `Your content has been posted to ${selectedPlatforms.join(', ')}.`,
      });
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['/api/social/posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
    },
    onError: (error) => {
      toast({
        title: "Post Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handlePost = () => {
    if (!content.trim()) {
      toast({
        title: "Content Required",
        description: "Please enter some content to post.",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Platform Required",
        description: "Please select at least one platform to post to.",
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate({
      content,
      platforms: selectedPlatforms,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Social Media Management</CardTitle>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Post
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Post Composer */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Create New Post</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening in Omaha real estate today?"
                rows={6}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {platforms.map((platform) => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatforms.includes(platform.id);
                  
                  return (
                    <Badge
                      key={platform.id}
                      variant="secondary"
                      className={`cursor-pointer transition-all ${
                        isSelected ? platform.bgColor + ' ' + platform.color : ''
                      }`}
                      onClick={() => togglePlatform(platform.id)}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {platform.name}
                      {isSelected && <Check className="w-3 h-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
              
              <Button 
                onClick={handlePost}
                disabled={postMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {postMutation.isPending ? "Posting..." : "Post Now"}
              </Button>
            </div>
          </div>
          
          {/* Platform Stats */}
          <div className="space-y-4">
            <h4 className="font-medium">Platform Performance</h4>
            
            <div className="space-y-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const data = metrics?.[platform.id as keyof PlatformMetrics];
                
                if (!data) return null;
                
                const mainMetric = platform.id === 'youtube' ? data.weeklyViews : 
                               'weeklyEngagement' in data ? data.weeklyEngagement : 0;
                const followers = platform.id === 'youtube' ? data.subscribers :
                                'followers' in data ? data.followers : 0;
                
                return (
                  <div key={platform.id} className={`flex items-center justify-between p-3 ${platform.bgColor} rounded-lg`}>
                    <div className="flex items-center space-x-3">
                      <Icon className={`${platform.color} text-lg`} />
                      <div>
                        <p className="font-medium text-gray-900">{platform.name}</p>
                        <p className="text-sm text-gray-700">
                          {followers.toLocaleString()} {platform.id === 'youtube' ? 'subscribers' : 'followers'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{mainMetric.toLocaleString()}</p>
                      <p className="text-sm text-gray-700">
                        {platform.id === 'youtube' ? 'Views this week' : 'This week'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
