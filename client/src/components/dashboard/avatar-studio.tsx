import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Square,
  Hash,
  Trash2,
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
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceName, setVoiceName] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // HeyGen voice ID state
  const [heygenVoiceId, setHeygenVoiceId] = useState("");
  const [voiceTab, setVoiceTab] = useState("professional");

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

  // Show all user's voices - they can still use audio_url even if HeyGen upload failed
  const customVoices = customVoicesData;

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

  const uploadVoiceMutation = useMutation({
    mutationFn: async ({ blob, name }: { blob: Blob; name: string }) => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("name", name);

      const response = await fetch("/api/custom-voices", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload voice");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Voice Uploaded!",
        description: "Your custom voice has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      setSelectedVoiceId(`voice_library_${data.id}`);
      setRecordedBlob(null);
      setRecordedUrl("");
      setVoiceName("");
      setVoiceTab("custom");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await fetch(`/api/custom-voices/${voiceId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete voice");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Voice Deleted",
        description: "Your custom voice has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      if (selectedVoiceId.startsWith("voice_library_")) {
        setSelectedVoiceId("119caed25533477ba63822d5d1552d25");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record your voice.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUseHeygenVoice = () => {
    if (heygenVoiceId.trim()) {
      setSelectedVoiceId(heygenVoiceId.trim());
      toast({
        title: "HeyGen Voice Selected",
        description: `Using voice ID: ${heygenVoiceId.trim()}`,
      });
    }
  };

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

              <Tabs value={voiceTab} onValueChange={setVoiceTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="professional" className="text-xs sm:text-sm" data-testid="tab-professional">
                    <Volume2 className="h-4 w-4 mr-1 hidden sm:inline" />
                    Professional
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs sm:text-sm" data-testid="tab-custom">
                    <Mic className="h-4 w-4 mr-1 hidden sm:inline" />
                    My Voices
                  </TabsTrigger>
                  <TabsTrigger value="record" className="text-xs sm:text-sm" data-testid="tab-record">
                    <Mic className="h-4 w-4 mr-1 hidden sm:inline" />
                    Record
                  </TabsTrigger>
                  <TabsTrigger value="heygen" className="text-xs sm:text-sm" data-testid="tab-heygen">
                    <Hash className="h-4 w-4 mr-1 hidden sm:inline" />
                    Voice ID
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="professional" className="space-y-3 mt-4">
                  <p className="text-sm text-gray-500">Select from our professional voice library</p>
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
                </TabsContent>

                <TabsContent value="custom" className="space-y-3 mt-4">
                  {customVoices.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-500">Your saved custom voices</p>
                      <div className="grid gap-2">
                        {customVoices.map((voice) => (
                          <div
                            key={voice.id}
                            onClick={() => setSelectedVoiceId(`voice_library_${voice.id}`)}
                            className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
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
                              {voice.status === "ready" && voice.heygenAudioAssetId && (
                                <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Ready</Badge>
                              )}
                              {voice.status === "failed" && (
                                <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Audio Only</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete "${voice.name}"? This cannot be undone.`)) {
                                    deleteVoiceMutation.mutate(voice.id);
                                  }
                                }}
                                disabled={deleteVoiceMutation.isPending}
                                data-testid={`button-delete-custom-voice-${voice.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Mic className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">No custom voices yet</p>
                      <p className="text-sm text-gray-400">Record a voice in the "Record" tab to create one</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="record" className="space-y-4 mt-4">
                  <p className="text-sm text-gray-500">Record your own voice for the avatar</p>
                  
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg space-y-4">
                    {!recordedBlob ? (
                      <>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                          isRecording 
                            ? "bg-red-500 animate-pulse" 
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}>
                          <Mic className={`h-10 w-10 ${isRecording ? "text-white" : "text-gray-400"}`} />
                        </div>
                        
                        {isRecording && (
                          <div className="text-2xl font-mono text-red-500">
                            {formatTime(recordingTime)}
                          </div>
                        )}
                        
                        <Button
                          size="lg"
                          onClick={isRecording ? stopRecording : startRecording}
                          className={isRecording 
                            ? "bg-red-500 hover:bg-red-600" 
                            : "bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                          }
                          data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
                        >
                          {isRecording ? (
                            <>
                              <Square className="h-5 w-5 mr-2" />
                              Stop Recording
                            </>
                          ) : (
                            <>
                              <Mic className="h-5 w-5 mr-2" />
                              Start Recording
                            </>
                          )}
                        </Button>
                        
                        <p className="text-xs text-gray-500">
                          Record at least 30 seconds of clear speech for best results
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-full space-y-4">
                          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                const audio = new Audio(recordedUrl);
                                audio.play();
                              }}
                              data-testid="button-play-recording"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <div className="flex-1">
                              <p className="font-medium">Recording Complete</p>
                              <p className="text-sm text-gray-500">{formatTime(recordingTime)} recorded</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRecordedBlob(null);
                                setRecordedUrl("");
                                setRecordingTime(0);
                              }}
                              data-testid="button-discard-recording"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="voice-name">Voice Name</Label>
                            <Input
                              id="voice-name"
                              value={voiceName}
                              onChange={(e) => setVoiceName(e.target.value)}
                              placeholder="e.g., My Professional Voice"
                              data-testid="input-voice-name"
                            />
                          </div>
                          
                          <Button
                            className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                            disabled={!voiceName.trim() || uploadVoiceMutation.isPending}
                            onClick={() => {
                              if (recordedBlob && voiceName.trim()) {
                                uploadVoiceMutation.mutate({
                                  blob: recordedBlob,
                                  name: voiceName.trim(),
                                });
                              }
                            }}
                            data-testid="button-save-voice"
                          >
                            {uploadVoiceMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Save Voice
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="heygen" className="space-y-4 mt-4">
                  <p className="text-sm text-gray-500">Enter a HeyGen voice ID to use a specific voice</p>
                  
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="heygen-voice-id">HeyGen Voice ID</Label>
                      <Input
                        id="heygen-voice-id"
                        value={heygenVoiceId}
                        onChange={(e) => setHeygenVoiceId(e.target.value)}
                        placeholder="e.g., 1bd001e7e50f421d891986aad5158bc8"
                        className="font-mono text-sm"
                        data-testid="input-heygen-voice-id"
                      />
                      <p className="text-xs text-gray-500">
                        Find voice IDs in your HeyGen dashboard under Voices
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleUseHeygenVoice}
                      disabled={!heygenVoiceId.trim()}
                      className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                      data-testid="button-use-heygen-voice"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Use This Voice
                    </Button>
                    
                    {selectedVoiceId && !selectedVoiceId.startsWith("voice_library_") && 
                     !PROFESSIONAL_VOICES.find(v => v.id === selectedVoiceId) && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                          Using voice ID: {selectedVoiceId}
                        </span>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
