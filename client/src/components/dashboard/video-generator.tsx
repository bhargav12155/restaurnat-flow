import { ObjectUploader } from "@/components/ObjectUploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Clock,
  Edit2,
  Eye,
  FileVideo,
  Hand,
  Image,
  Info,
  Play,
  Sparkles,
  Upload,
  User,
  Video,
  Wand2,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OmahaVideoTemplates } from "./omaha-video-templates";

interface Avatar {
  id: string;
  name: string;
  description: string;
  style: string;
  gender: string;
  isActive: boolean;
  supportsGestures?: boolean;
}

interface VideoContent {
  id: string;
  title: string;
  script: string;
  topic: string;
  neighborhood: string | null;
  videoType: string;
  duration: number | null;
  status: string;
  tags: string[];
  avatarId: string | null;
  videoUrl: string | null;
  youtubeUrl: string | null;
  createdAt: string;
}

const videoTypes = [
  { value: "market_update", label: "Market Update", icon: "📊" },
  { value: "neighborhood_tour", label: "Neighborhood Tour", icon: "🏘️" },
  { value: "buyer_tips", label: "Buyer Tips", icon: "💡" },
  { value: "seller_guide", label: "Seller Guide", icon: "🏠" },
  { value: "moving_guide", label: "Moving Guide", icon: "📦" },
];

const videoPlatforms = [
  {
    value: "youtube",
    label: "YouTube",
    icon: "🎥",
    description: "Long-form educational content (1-10 minutes)",
  },
  {
    value: "reels",
    label: "Reels",
    icon: "📱",
    description: "Short vertical videos (15-90 seconds)",
  },
  {
    value: "story",
    label: "Story",
    icon: "📸",
    description: "Quick updates & behind-the-scenes (15 seconds)",
  },
];

const neighborhoods = [
  "Dundee",
  "Aksarben",
  "Old Market",
  "Blackstone",
  "Benson",
];

export function VideoGenerator() {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [avatarType, setAvatarType] = useState<
    "public" | "talking_photo" | "custom"
  >("public");
  const [uploadedAvatarPhoto, setUploadedAvatarPhoto] = useState<string | null>(
    null
  );
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTopic, setVideoTopic] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");
  const [selectedVideoType, setSelectedVideoType] = useState("");
  const [selectedVideoPlatform, setSelectedVideoPlatform] = useState("youtube");
  const [duration, setDuration] = useState("60");
  const [generatedScript, setGeneratedScript] = useState("");
  const [gestureIntensity, setGestureIntensity] = useState(0);
  const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
  const [watchingVideo, setWatchingVideo] = useState<VideoContent | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadVideoTitle, setUploadVideoTitle] = useState("");
  const [uploadVideoDescription, setUploadVideoDescription] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previousStatusesRef = useRef<Record<string, string>>({});
  const shownToastForVideoRef = useRef<Set<string>>(new Set());

  const { data: avatars } = useQuery<Avatar[]>({
    queryKey: ["/api/avatars"],
  });

  const { data: photoAvatarGroupsResponse } = useQuery({
    queryKey: ["/api/photo-avatars/groups"],
  });

  const { data: videoAvatars } = useQuery({
    queryKey: ["/api/video-avatars"],
  });

  const { data: videos } = useQuery<VideoContent[]>({
    queryKey: ["/api/videos"],
    refetchInterval: 30000, // Refresh every 30 seconds for status updates
  });

  // Combine photo avatar groups as custom avatars
  const photoAvatarGroups = photoAvatarGroupsResponse?.avatar_group_list || [];
  const readyPhotoAvatars = photoAvatarGroups.filter(
    (group: any) => group.status === "ready" && group.num_looks > 0
  );

  // Reset duration when platform changes
  useEffect(() => {
    if (selectedVideoPlatform === "story") {
      setDuration("15");
    } else if (selectedVideoPlatform === "reels") {
      setDuration("30");
    } else if (selectedVideoPlatform === "youtube") {
      setDuration("120");
    }
  }, [selectedVideoPlatform]);

  // Watch for video generation completion
  useEffect(() => {
    if (!videos) return;

    videos.forEach((video) => {
      const previousStatus = previousStatusesRef.current[video.id];
      const currentStatus = video.status;
      const alreadyShownToast = shownToastForVideoRef.current.has(video.id);

      // Detect when a video is ready (either just transitioned OR initially ready)
      const isReady = currentStatus === "ready";
      const justTransitioned = previousStatus && previousStatus !== "ready";
      const shouldShowToast =
        isReady && !alreadyShownToast && (!previousStatus || justTransitioned);

      if (shouldShowToast) {
        // Video is ready - show toast notification
        shownToastForVideoRef.current.add(video.id);

        toast({
          title: "🎉 Video Ready!",
          description: `Your video "${video.title}" has been generated successfully!`,
        });
      }

      // Update the status tracker
      previousStatusesRef.current[video.id] = currentStatus;
    });
  }, [videos, toast]);

  const createVideoMutation = useMutation({
    mutationFn: async (videoData: any) => {
      const response = await apiRequest("POST", "/api/videos", videoData);
      return response.json();
    },
    onSuccess: async (newVideo) => {
      toast({
        title: "Video Project Created!",
        description: "Now generating video with HeyGen...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });

      // Automatically trigger video generation if avatar is selected
      if (selectedAvatar) {
        try {
          console.log("🎬 Auto-generating video:", {
            videoId: newVideo.id,
            avatarId: selectedAvatar,
            avatarType: avatarType,
            gestureIntensity: gestureIntensity,
          });

          await generateVideoMutation.mutateAsync({
            videoId: newVideo.id,
            avatarId: selectedAvatar,
            avatarType: avatarType === "custom" ? "talking_photo" : "avatar",
            uploadedAvatarPhoto: null,
            gestureIntensity: avatarType === "custom" ? gestureIntensity : 0,
          });
        } catch (error) {
          console.error("❌ Auto-generation failed:", error);
          toast({
            title: "Generation Error",
            description:
              "Video created but generation failed. Try generating manually.",
            variant: "destructive",
          });
        }
      }

      // Reset form
      setVideoTitle("");
      setVideoTopic("");
      setSelectedNeighborhood("");
      setSelectedVideoType("");
      setSelectedVideoPlatform("youtube");
      setGeneratedScript("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create video",
        variant: "destructive",
      });
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async ({ topic, neighborhood, videoType, duration }: any) => {
      // Generate script via OpenAI without needing a video ID
      const response = await apiRequest("POST", "/api/generate-script", {
        topic,
        neighborhood,
        videoType,
        platform: selectedVideoPlatform,
        duration: parseInt(duration),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      toast({
        title: "Script Generated!",
        description: "AI has created your video script",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate script",
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async ({
      videoId,
      avatarId,
      avatarType: type,
      uploadedAvatarPhoto: photoUrl,
      gestureIntensity: intensity,
    }: {
      videoId: string;
      avatarId?: string;
      avatarType?: string;
      uploadedAvatarPhoto?: string | null;
      gestureIntensity?: number;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/videos/${videoId}/generate-video`,
        {
          avatarId,
          avatarType: type,
          uploadedAvatarPhoto: photoUrl,
          gestureIntensity: intensity,
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Video Generation Started!",
        description: `Your AI video is being created. Estimated time: ${data.estimatedTime}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      });
    },
  });

  const uploadToYoutubeMutation = useMutation({
    mutationFn: async ({ videoId, title, description, tags }: any) => {
      const response = await apiRequest(
        "POST",
        `/api/videos/${videoId}/upload-youtube`,
        {
          title,
          description,
          tags,
          privacy: "public",
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Uploaded to YouTube!",
        description: "Your video is now live on YouTube",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload to YouTube",
        variant: "destructive",
      });
    },
  });

  const handleCreateVideo = () => {
    if (!videoTitle || !videoTopic) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and topic for your video",
        variant: "destructive",
      });
      return;
    }

    // Check avatar selection - must have either public or custom avatar
    const hasPublicAvatar = avatarType === "public" && selectedAvatar;
    const hasCustomAvatar = avatarType === "custom" && selectedAvatar;

    if (!hasPublicAvatar && !hasCustomAvatar) {
      toast({
        title: "Avatar Required",
        description: `Please select a ${
          avatarType === "public" ? "public" : "custom photo"
        } avatar to generate the video`,
        variant: "destructive",
      });
      return;
    }

    createVideoMutation.mutate({
      title: videoTitle,
      script: generatedScript || `This is a video about ${videoTopic}`,
      topic: videoTopic,
      neighborhood: selectedNeighborhood || null,
      videoType: selectedVideoType || "market_update",
      platform: selectedVideoPlatform,
      duration: parseInt(duration),
      avatarId: selectedAvatar, // This is either a public avatar ID or photo avatar group_id
      tags: [
        "OmahaRealEstate",
        "RealEstate",
        selectedNeighborhood,
        selectedVideoType,
        selectedVideoPlatform,
      ].filter(Boolean),
      status: "generating", // Send to HeyGen immediately
    });
  };

  const handleGenerateScript = () => {
    if (!videoTopic) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your video",
        variant: "destructive",
      });
      return;
    }

    generateScriptMutation.mutate({
      topic: videoTopic,
      neighborhood: selectedNeighborhood,
      videoType: selectedVideoType,
      duration,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "ready":
        return "bg-green-100 text-green-700";
      case "generating":
        return "bg-blue-100 text-blue-700 animate-pulse";
      case "uploaded":
        return "bg-purple-100 text-purple-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Edit2 className="h-3 w-3" />;
      case "ready":
        return <Play className="h-3 w-3" />;
      case "generating":
        return <Wand2 className="h-3 w-3" />;
      case "uploaded":
        return <Youtube className="h-3 w-3" />;
      case "failed":
        return <X className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  return null;
}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
