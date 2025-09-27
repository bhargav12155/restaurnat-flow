import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Facebook, Instagram, Twitter, Youtube, Plus, AlertCircle, Clock } from "lucide-react";
import { z } from "zod";
import { useState } from "react";

interface SocialPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'published';
  createdAt: string;
}

interface SocialMetrics {
  platforms: Array<{
    name: string;
    status: 'connected' | 'disconnected';
    followers?: number;
    engagement?: number;
  }>;
}

const createPostSchema = z.object({
  content: z.string().min(10, "Content must be at least 10 characters long"),
  platforms: z.array(z.string()).min(1, "Select at least one platform"),
  scheduledAt: z.string().optional(),
});

type CreatePostFormData = z.infer<typeof createPostSchema>;

export function SocialMediaManager() {
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch social posts
  const { data: posts, isLoading: postsLoading, error: postsError } = useQuery<SocialPost[]>({
    queryKey: ["/api/social/posts"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch platform metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SocialMetrics>({
    queryKey: ["/api/social/metrics"],
    refetchInterval: 60000, // Refresh every minute
  });

  const createPostForm = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      content: "",
      platforms: [],
      scheduledAt: "",
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: CreatePostFormData) => {
      const response = await apiRequest("POST", "/api/social/post", {
        content: data.content,
        platforms: data.platforms,
        scheduledAt: data.scheduledAt || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Created Successfully!",
        description: "Your social media post has been scheduled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/metrics"] });
      setCreatePostOpen(false);
      createPostForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Post",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onCreatePost = (data: CreatePostFormData) => {
    createPostMutation.mutate(data);
  };

  const platforms = [
    { name: "Facebook", icon: Facebook, color: "bg-blue-500", key: "facebook" },
    { name: "Instagram", icon: Instagram, color: "bg-pink-500", key: "instagram" },
    { name: "Twitter", icon: Twitter, color: "bg-gray-900", key: "twitter" },
    { name: "YouTube", icon: Youtube, color: "bg-red-500", key: "youtube" },
  ];

  const formatScheduledTime = (scheduledAt: string) => {
    const date = new Date(scheduledAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    return `${date.toLocaleDateString()} ${timeStr}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle data-testid="title-social-media-manager">Social Media Manager</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-3">Connected Platforms</h4>
          {metricsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const platformMetrics = metrics?.platforms?.find(p => 
                  p.name.toLowerCase() === platform.name.toLowerCase()
                );
                const status = platformMetrics?.status || "disconnected";
                
                return (
                  <div key={platform.name} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded ${platform.color}`}>
                        <Icon className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm">{platform.name}</span>
                    </div>
                    <Badge 
                      variant={status === "connected" ? "default" : "secondary"}
                      data-testid={`platform-${platform.key}-status`}
                    >
                      {status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">Scheduled Posts</h4>
          {postsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : postsError ? (
            <div className="flex items-center space-x-2 text-destructive p-3 border rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to load scheduled posts</p>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-2" data-testid="scheduled-posts-list">
              {posts.slice(0, 3).map((post) => (
                <div key={post.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex space-x-1">
                      {post.platforms.map((platform) => (
                        <Badge key={platform} variant="outline" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                    <Badge 
                      variant={post.status === "scheduled" ? "default" : "secondary"}
                      data-testid={`post-${post.id}-status`}
                    >
                      {post.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {post.content}
                  </p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="mr-1 h-3 w-3" />
                    {post.scheduledAt ? formatScheduledTime(post.scheduledAt) : "Draft"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-3 border rounded-lg">
              No scheduled posts yet. Create your first post!
            </p>
          )}
        </div>

        <Dialog open={createPostOpen} onOpenChange={setCreatePostOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-create-new-post">
              <Plus className="mr-2 h-4 w-4" />
              Create New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Social Media Post</DialogTitle>
            </DialogHeader>
            <Form {...createPostForm}>
              <form onSubmit={createPostForm.handleSubmit(onCreatePost)} className="space-y-4">
                <FormField
                  control={createPostForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Write your social media post content..."
                          className="min-h-24"
                          {...field}
                          data-testid="textarea-post-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createPostForm.control}
                  name="platforms"
                  render={() => (
                    <FormItem>
                      <FormLabel>Platforms</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {platforms.map((platform) => (
                          <FormField
                            key={platform.key}
                            control={createPostForm.control}
                            name="platforms"
                            render={({ field }) => {
                              return (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(platform.key)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, platform.key])
                                          : field.onChange(
                                              field.value?.filter((value) => value !== platform.key)
                                            )
                                      }}
                                      data-testid={`checkbox-platform-${platform.key}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {platform.name}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createPostForm.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule For (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local"
                          {...field}
                          data-testid="input-scheduled-at"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCreatePostOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createPostMutation.isPending}
                    data-testid="button-submit-post"
                  >
                    {createPostMutation.isPending ? "Creating..." : "Create Post"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}