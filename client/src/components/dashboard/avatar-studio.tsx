import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mic,
  Video,
  Check,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  Play,
  Pause,
  Loader2,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Clock,
  Wand2,
  Volume2,
  X,
} from "lucide-react";

const PROFESSIONAL_VOICES = [
  { id: "92c93dc0dff2428ab0bea258ba68f173", name: "Professional Male - Confident" },
  { id: "f577da968446491289b53bceb77e5092", name: "Professional Male - Warm" },
  { id: "73c0b6a2e29d4d38aca41454bf58c955", name: "Professional Female - Clear" },
  { id: "1c7c897eeb2d4b5fb17d3c6c70250b24", name: "Professional Female - Friendly" },
  { id: "119caed25533477ba63822d5d1552d25", name: "Neutral - Balanced" },
  { id: "9f2e8c4a7b5d4f6e8a1c3d5b7e9f2a4c", name: "Energetic - Enthusiastic" },
];

interface PhotoAvatarGroup {
  group_id: string;
  name: string;
  status: string;
  train_status?: string;
  num_looks?: number;
  created_at: string;
  avatar_count?: number;
}

interface AvatarLook {
  id: string;
  avatar_id?: string;
  image_url: string;
  image?: string;
  status: string;
}

interface CustomVoice {
  id: string;
  name: string;
  audioUrl: string;
  status?: string;
  duration?: number;
}

interface VideoGeneration {
  video_id: string;
  id?: string;
  status: string;
  video_url?: string;
  videoUrl?: string;
  thumbnail_url?: string;
  error?: string;
}

const STEPS = [
  { id: 1, title: "Select Avatar", icon: User },
  { id: 2, title: "Choose Voice", icon: Mic },
  { id: 3, title: "Create Video", icon: Video },
];

export function AvatarStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAvatarGroup, setSelectedAvatarGroup] = useState<string>("");
  const [selectedAvatarLook, setSelectedAvatarLook] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("119caed25533477ba63822d5d1552d25");
  const [script, setScript] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [currentVideo, setCurrentVideo] = useState<VideoGeneration | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceAudioUrls, setVoiceAudioUrls] = useState<Record<string, string>>({});

  const { data: avatarGroupsResponse, isLoading: groupsLoading } = useQuery<{
    avatar_group_list?: PhotoAvatarGroup[];
  }>({
    queryKey: ["/api/photo-avatars/groups"],
    refetchInterval: 10000,
  });

  const avatarGroups: PhotoAvatarGroup[] = avatarGroupsResponse?.avatar_group_list ?? [];
  
  const readyAvatarGroups = avatarGroups.filter((group) => {
    const status = (group.status || "").toLowerCase();
    const trainStatus = (group.train_status || "").toLowerCase();
    return status === "ready" || trainStatus === "ready" || (group.num_looks || 0) > 0;
  });

  const { data: selectedGroupLooks } = useQuery<{
    avatar_list?: AvatarLook[];
  }>({
    queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"],
    enabled: !!selectedAvatarGroup,
    refetchInterval: selectedAvatarGroup ? 7000 : false,
  });

  const availableLooks = (selectedGroupLooks?.avatar_list || []).filter((look) => {
    const status = (look.status || "").toLowerCase();
    return status === "completed" || status === "ready";
  });

  const { data: customVoicesData = [] } = useQuery<CustomVoice[]>({
    queryKey: ["/api/custom-voices"],
  });

  const customVoices = customVoicesData.filter(
    (voice) => !voice.status || voice.status === "ready"
  );

  useEffect(() => {
    if (customVoices.length === 0) return;

    const fetchAudioUrls = async () => {
      const urls: Record<string, string> = {};
      
      for (const voice of customVoices) {
        try {
          const response = await fetch(`/api/custom-voices/${voice.id}/audio`, {
            credentials: "include",
          });
          
          if (response.ok) {
            const blob = await response.blob();
            urls[voice.id] = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.error(`Failed to load audio for voice ${voice.id}:`, error);
        }
      }
      
      setVoiceAudioUrls(urls);
    };

    fetchAudioUrls();

    return () => {
      Object.values(voiceAudioUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [customVoices.length]);

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const formData = new FormData();
      formData.append("photo", file);

      const uploadResponse = await fetch("/api/photo-avatars/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");
      const uploadData = await uploadResponse.json();

      const createResponse = await fetch("/api/photo-avatars/create-from-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          imageKeys: [uploadData.imageKey],
        }),
      });

      if (!createResponse.ok) throw new Error("Failed to create avatar group");
      return createResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Photo Uploaded",
        description: "Avatar group created. Training will start automatically.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      setShowQuickUpload(false);
      setUploadedFile(null);
      setUploadName("");
      if (data?.group?.group_id) {
        setSelectedAvatarGroup(data.group.group_id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async (data: {
      avatarId: string;
      script: string;
      title: string;
      voiceId: string;
      voiceLibraryId?: string;
    }) => {
      const response = await apiRequest("POST", "/api/videos/generate", {
        avatarId: data.avatarId,
        script: data.script,
        title: data.title,
        voiceId: data.voiceLibraryId ? "voice_library" : data.voiceId,
        voiceLibraryId: data.voiceLibraryId,
        isTalkingPhoto: true,
        test: false,
        voiceSpeed: 1.0,
      });
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentVideo(result.data || result);
      setShowVideoDialog(true);
      toast({
        title: "Video Generation Started!",
        description: "Your AI avatar video is being created. This may take a few minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to start video generation",
        variant: "destructive",
      });
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest("GET", `/api/videos/${videoId}/status`);
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentVideo((prev) => (prev ? { ...prev, ...result } : result));
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-script", {
        topic: videoTitle || "professional introduction",
        videoType: "introduction",
        platform: "youtube",
        duration: 60,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setScript(data.script || "");
      toast({
        title: "Script Generated!",
        description: "AI has created a script for you.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to generate script",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (showVideoDialog && currentVideo?.video_id) {
      const interval = setInterval(() => {
        checkStatusMutation.mutate(currentVideo.video_id);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [showVideoDialog, currentVideo?.video_id]);

  const canProceedToStep2 = !!selectedAvatarLook;
  const canProceedToStep3 = !!selectedVoiceId;
  const canGenerateVideo = !!selectedAvatarLook && !!selectedVoiceId && script.trim().length > 0;

  const handleNext = () => {
    if (currentStep === 1 && !canProceedToStep2) {
      toast({
        title: "Avatar Required",
        description: "Please select an avatar look to proceed.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep === 2 && !canProceedToStep3) {
      toast({
        title: "Voice Required",
        description: "Please select a voice to proceed.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerateVideo = () => {
    if (!canGenerateVideo) {
      toast({
        title: "Missing Information",
        description: "Please complete all steps before generating.",
        variant: "destructive",
      });
      return;
    }

    // Extract voice library ID if using a custom voice
    let voiceLibraryId: string | undefined;
    let finalVoiceId = selectedVoiceId;
    
    if (selectedVoiceId.startsWith("voice_library_")) {
      voiceLibraryId = selectedVoiceId.replace("voice_library_", "");
      finalVoiceId = "voice_library";
    }

    generateVideoMutation.mutate({
      avatarId: selectedAvatarLook,
      script: script.trim(),
      title: videoTitle.trim() || "AI Avatar Video",
      voiceId: finalVoiceId,
      voiceLibraryId,
    });
  };

  const handlePlayVoice = (voiceId: string, audioUrl?: string) => {
    if (playingVoiceId === voiceId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingVoiceId(voiceId);
    }
  };

  const selectedGroup = avatarGroups.find((g) => g.group_id === selectedAvatarGroup);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "ready":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
      case "generating":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="avatar-studio">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#D4AF37]" />
            Avatar Studio
          </CardTitle>
          <CardDescription>
            Create professional AI avatar videos in 3 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-8 px-4">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isClickable = step.id < currentStep || 
                (step.id === 2 && canProceedToStep2) || 
                (step.id === 3 && canProceedToStep2 && canProceedToStep3);

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => isClickable && setCurrentStep(step.id)}
                    disabled={!isClickable}
                    className={`flex flex-col items-center flex-1 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    data-testid={`step-${step.id}`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                        isActive
                          ? "bg-[#D4AF37] text-white shadow-lg"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <StepIcon className="h-6 w-6" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive ? "text-[#D4AF37]" : isCompleted ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${
                        currentStep > step.id ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <Progress 
            value={(currentStep / 3) * 100} 
            className="mb-6 h-2"
            data-testid="progress-indicator"
          />

          {currentStep === 1 && (
            <div className="space-y-6" data-testid="step-1-content">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Your Avatar</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickUpload(true)}
                  className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                  data-testid="button-quick-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Quick Upload
                </Button>
              </div>

              {groupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
                </div>
              ) : readyAvatarGroups.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No trained avatars available yet.</p>
                  <Button
                    onClick={() => setShowQuickUpload(true)}
                    className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                    data-testid="button-upload-first-avatar"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Your First Photo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {readyAvatarGroups.map((group) => (
                    <button
                      key={group.group_id}
                      onClick={() => {
                        setSelectedAvatarGroup(group.group_id);
                        setSelectedAvatarLook("");
                      }}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                        selectedAvatarGroup === group.group_id
                          ? "border-[#D4AF37] bg-[#D4AF37]/5 shadow-lg"
                          : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                      }`}
                      data-testid={`avatar-group-${group.group_id}`}
                    >
                      {selectedAvatarGroup === group.group_id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        <User className="h-12 w-12 text-gray-400" />
                      </div>
                      <p className="font-medium text-sm truncate" data-testid={`text-group-name-${group.group_id}`}>
                        {group.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge
                          variant={group.train_status === "ready" ? "default" : "secondary"}
                          className="text-xs"
                          data-testid={`badge-status-${group.group_id}`}
                        >
                          {group.train_status || group.status || "pending"}
                        </Badge>
                        {(group.num_looks || 0) > 0 && (
                          <span className="text-xs text-gray-500">
                            {group.num_looks} look{(group.num_looks || 0) > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedAvatarGroup && availableLooks.length > 0 && (
                <div className="mt-6">
                  <Label className="text-sm font-medium mb-3 block">
                    Select an Avatar Look
                  </Label>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {availableLooks.map((look) => {
                      const lookId = look.avatar_id || look.id;
                      const imageUrl = look.image_url || look.image || "";
                      return (
                        <button
                          key={lookId}
                          onClick={() => setSelectedAvatarLook(lookId)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                            selectedAvatarLook === lookId
                              ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                          }`}
                          data-testid={`avatar-look-${lookId}`}
                        >
                          {selectedAvatarLook === lookId && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center z-10">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <img
                            src={imageUrl}
                            alt={`Look ${lookId}`}
                            className="w-full aspect-square object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedAvatarGroup && availableLooks.length === 0 && (
                <div className="text-center py-6 text-gray-500 border rounded-lg mt-4">
                  <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                  <p>No looks available yet. Training may still be in progress.</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6" data-testid="step-2-content">
              <h3 className="text-lg font-semibold">Choose Your Voice</h3>

              {customVoices.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-[#D4AF37] flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    My Custom Voices
                  </Label>
                  <div className="grid gap-2">
                    {customVoices.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => setSelectedVoiceId(`voice_library_${voice.id}`)}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          selectedVoiceId === `voice_library_${voice.id}`
                            ? "border-[#D4AF37] bg-[#D4AF37]/5"
                            : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                        }`}
                        data-testid={`voice-custom-${voice.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {selectedVoiceId === `voice_library_${voice.id}` && (
                            <div className="w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <Mic className="h-5 w-5 text-[#D4AF37]" />
                          <span className="font-medium">{voice.name}</span>
                          <Badge variant="outline" className="text-xs">Custom</Badge>
                        </div>
                        {voiceAudioUrls[voice.id] && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayVoice(voice.id, voiceAudioUrls[voice.id]);
                            }}
                            data-testid={`button-play-custom-voice-${voice.id}`}
                          >
                            {playingVoiceId === voice.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Professional Voices
                </Label>
                <div className="grid gap-2">
                  {PROFESSIONAL_VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoiceId(voice.id)}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        selectedVoiceId === voice.id
                          ? "border-[#D4AF37] bg-[#D4AF37]/5"
                          : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                      }`}
                      data-testid={`voice-professional-${voice.id}`}
                    >
                      {selectedVoiceId === voice.id && (
                        <div className="w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <Volume2 className="h-5 w-5 text-gray-500" />
                      <span className="font-medium">{voice.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6" data-testid="step-3-content">
              <h3 className="text-lg font-semibold">Create Your Video</h3>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Selected:</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#D4AF37]" />
                    <span className="font-medium">{selectedGroup?.name || "Avatar"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-[#D4AF37]" />
                    <span className="font-medium">
                      {PROFESSIONAL_VOICES.find((v) => v.id === selectedVoiceId)?.name ||
                        customVoices.find((v) => `voice_library_${v.id}` === selectedVoiceId)?.name ||
                        "Voice"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-title">Video Title</Label>
                <Input
                  id="video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g., Welcome to Our Agency"
                  data-testid="input-video-title"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="script">Script</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateScriptMutation.mutate()}
                    disabled={generateScriptMutation.isPending}
                    className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    data-testid="button-ai-assist"
                  >
                    {generateScriptMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    AI Assist
                  </Button>
                </div>
                <Textarea
                  id="script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter what your avatar will say..."
                  rows={6}
                  className="resize-none"
                  data-testid="textarea-script"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{script.length}/1500 characters</span>
                  {script.length > 1500 && (
                    <span className="text-red-500">Script too long</span>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={handleGenerateVideo}
                  disabled={!canGenerateVideo || generateVideoMutation.isPending || script.length > 1500}
                  className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  data-testid="button-generate-video"
                >
                  {generateVideoMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Starting Generation...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                data-testid="button-next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showQuickUpload} onOpenChange={setShowQuickUpload}>
        <DialogContent data-testid="dialog-quick-upload">
          <DialogHeader>
            <DialogTitle>Quick Upload Photo</DialogTitle>
            <DialogDescription>
              Upload a photo to create a new avatar quickly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-name">Avatar Name</Label>
              <Input
                id="upload-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g., My Professional Avatar"
                data-testid="input-upload-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-file">Photo</Label>
              <Input
                id="upload-file"
                type="file"
                accept="image/*"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                data-testid="input-upload-file"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowQuickUpload(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (uploadedFile && uploadName.trim()) {
                    uploadPhotoMutation.mutate({
                      file: uploadedFile,
                      name: uploadName.trim(),
                    });
                  }
                }}
                disabled={!uploadedFile || !uploadName.trim() || uploadPhotoMutation.isPending}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                data-testid="button-confirm-upload"
              >
                {uploadPhotoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-video-status">
          <DialogHeader>
            <DialogTitle>Video Generation Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {currentVideo && (
              <>
                <div className="flex items-center gap-3">
                  {getStatusIcon(currentVideo.status)}
                  <span className="font-medium capitalize">
                    {currentVideo.status === "completed" || currentVideo.status === "ready"
                      ? "Video Ready!"
                      : currentVideo.status === "processing" || currentVideo.status === "generating"
                      ? "Generating your video..."
                      : currentVideo.status === "failed"
                      ? "Generation failed"
                      : "Processing..."}
                  </span>
                </div>

                {(currentVideo.status === "processing" || currentVideo.status === "generating" || currentVideo.status === "pending") && (
                  <div className="space-y-2">
                    <Progress value={undefined} className="animate-pulse" />
                    <p className="text-sm text-gray-500 text-center">
                      This usually takes 2-5 minutes. We'll update automatically.
                    </p>
                  </div>
                )}

                {(currentVideo.status === "completed" || currentVideo.status === "ready") && (currentVideo.video_url || currentVideo.videoUrl) && (
                  <div className="space-y-4">
                    <video
                      controls
                      className="w-full rounded-lg"
                      src={currentVideo.video_url || currentVideo.videoUrl}
                      data-testid="video-player"
                    />
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const url = currentVideo.video_url || currentVideo.videoUrl;
                          if (url) window.open(url, "_blank");
                        }}
                        data-testid="button-download-video"
                      >
                        Download
                      </Button>
                      <Button
                        onClick={() => {
                          setShowVideoDialog(false);
                          setCurrentVideo(null);
                          setScript("");
                          setVideoTitle("");
                          setCurrentStep(1);
                        }}
                        className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                        data-testid="button-create-another"
                      >
                        Create Another
                      </Button>
                    </div>
                  </div>
                )}

                {currentVideo.status === "failed" && (
                  <div className="text-center py-6">
                    <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-red-500 mb-4">
                      {currentVideo.error || "Video generation failed. Please try again."}
                    </p>
                    <Button
                      onClick={() => {
                        setShowVideoDialog(false);
                        setCurrentVideo(null);
                      }}
                      variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
