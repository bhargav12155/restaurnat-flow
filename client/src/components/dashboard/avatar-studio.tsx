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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useDemo } from "@/contexts/DemoContext";
import demoMotionVideo from "@assets/preview_video_target_(1)_1765290240595.mp4";
import demoFinalVideo from "@assets/preview_video_target_(1)_1765291235450.mp4";
import demoEditLookResult from "@assets/demo-edit-look-result.jpg";
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
  Download,
  Terminal,
} from "lucide-react";

const PROFESSIONAL_VOICES = [
  { id: "92c93dc0dff2428ab0bea258ba68f173", name: "Professional Male - Confident" },
  { id: "f577da968446491289b53bceb77e5092", name: "Professional Male - Warm" },
  { id: "73c0b6a2e29d4d38aca41454bf58c955", name: "Professional Female - Clear" },
  { id: "1c7c897eeb2d4b5fb17d3c6c70250b24", name: "Professional Female - Friendly" },
  { id: "119caed25533477ba63822d5d1552d25", name: "Neutral - Balanced" },
  { id: "9f2e8c4a7b5d4f6e8a1c3d5b7e9f2a4c", name: "Energetic - Enthusiastic" },
];

const KLING_VOICES = [
  { id: "female_calm", name: "Female - Calm (The Reader)" },
  { id: "male_calm", name: "Male - Calm (Businessman)" },
  { id: "female_professional", name: "Female - Professional (Commercial Lady)" },
  { id: "male_professional", name: "Male - Professional (Businessman)" },
  { id: "female_warm", name: "Female - Warm (Sweet Girl)" },
  { id: "male_warm", name: "Male - Warm (Rock)" },
];

interface PhotoAvatarGroup {
  group_id: string;
  name: string;
  status: string;
  train_status?: string;
  num_looks?: number;
  created_at: string;
  avatar_count?: number;
  preview_image?: string;
}

interface AvatarLook {
  id: string;
  avatar_id?: string;
  image_url: string;
  image?: string;
  status: string;
  is_motion?: boolean;
  motion_preview_url?: string;
  name?: string;
}

interface CustomVoice {
  id: string;
  name: string;
  audioUrl: string;
  status?: string;
  duration?: number;
  heygenAudioAssetId?: string | null;
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

const PLATFORM_OPTIONS = [
  { id: "instagram_reel", name: "Instagram Reel", duration: 30, description: "15-30 sec optimal" },
  { id: "facebook_story", name: "Facebook Story", duration: 20, description: "15-20 sec optimal" },
  { id: "facebook_post", name: "Facebook Post", duration: 90, description: "1-2 min optimal" },
  { id: "twitter", name: "Twitter/X", duration: 45, description: "30-60 sec optimal" },
  { id: "youtube_short", name: "YouTube Short", duration: 30, description: "15-30 sec optimal" },
  { id: "tiktok", name: "TikTok", duration: 30, description: "21-34 sec optimal" },
  { id: "linkedin", name: "LinkedIn", duration: 90, description: "1-2 min optimal" },
  { id: "custom", name: "Custom Length", duration: 60, description: "Set your own duration" },
];

export function AvatarStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  
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
  const [showLookPopup, setShowLookPopup] = useState(false);
  const [popupLookIndex, setPopupLookIndex] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hoveredLookId, setHoveredLookId] = useState<string | null>(null);
  
  // Motion generation state
  const [showMotionDialog, setShowMotionDialog] = useState(false);
  const [motionPrompt, setMotionPrompt] = useState("");
  const [motionDuration, setMotionDuration] = useState<"5" | "10">("5");
  const [isGeneratingMotion, setIsGeneratingMotion] = useState(false);
  const [motionTaskId, setMotionTaskId] = useState<string | null>(null);
  const [motionStatus, setMotionStatus] = useState<string>("");
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [motionProgress, setMotionProgress] = useState(0);
  const [motionTab, setMotionTab] = useState<"templates" | "custom" | "upload">("templates");
  const [selectedMotionTemplate, setSelectedMotionTemplate] = useState<string>("talking_naturally");
  const [uploadName, setUploadName] = useState("");
  
  // Motion dialog step: "motion" -> "voice" -> "final"
  const [motionDialogStep, setMotionDialogStep] = useState<"motion" | "voice" | "final">("motion");
  const [motionVoiceScript, setMotionVoiceScript] = useState("");
  const [selectedMotionVoice, setSelectedMotionVoice] = useState<string>("female_calm");
  const [voiceProvider, setVoiceProvider] = useState<"elevenlabs" | "kling">("kling");
  const [isGeneratingLipSync, setIsGeneratingLipSync] = useState(false);
  const [lipSyncTaskId, setLipSyncTaskId] = useState<string | null>(null);
  const [lipSyncStatus, setLipSyncStatus] = useState<string>("");
  const [lipSyncProgress, setLipSyncProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  
  // Voice input mode for motion dialog: "tts" | "record" | "upload"
  const [voiceInputMode, setVoiceInputMode] = useState<"tts" | "record" | "upload">("tts");
  const [motionRecordedBlob, setMotionRecordedBlob] = useState<Blob | null>(null);
  const [motionRecordedUrl, setMotionRecordedUrl] = useState<string>("");
  const [motionRecordingTime, setMotionRecordingTime] = useState(0);
  const [isMotionRecording, setIsMotionRecording] = useState(false);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string>("");
  const motionMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const motionChunksRef = useRef<Blob[]>([]);
  const motionRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Upload motion video state (skip to voice step)
  const [uploadedMotionFile, setUploadedMotionFile] = useState<File | null>(null);
  const [uploadedMotionUrl, setUploadedMotionUrl] = useState<string>("");
  
  // Edit look result dialog (demo mode)
  const [showEditLookResult, setShowEditLookResult] = useState(false);
  
  // Motion templates based on HeyGen's offerings
  const MOTION_TEMPLATES = [
    { 
      id: "talking_naturally", 
      name: "Talking Naturally", 
      description: "Natural speaking motion with subtle head movements and expressions",
      prompt: "Person speaking naturally with subtle head movements, gentle nodding, natural blinks, and relaxed facial expressions as if having a friendly conversation"
    },
    { 
      id: "expert_presentation", 
      name: "Expert Presentation", 
      description: "Confident, authoritative presentation style",
      prompt: "Professional presenter speaking confidently with purposeful hand gestures, direct eye contact, and authoritative body language as if explaining an important topic"
    },
    { 
      id: "dynamic_announcement", 
      name: "Dynamic Announcement", 
      description: "Energetic, attention-grabbing delivery",
      prompt: "Energetic person making an exciting announcement with animated expressions, wider gestures, raised eyebrows, and enthusiastic body language"
    },
    { 
      id: "keynote_speaker", 
      name: "Keynote Speaker", 
      description: "Polished, inspiring speaker on stage",
      prompt: "Polished keynote speaker with measured movements, inspiring expressions, confident posture, and engaging eye contact as if addressing a large audience"
    },
    { 
      id: "thoughtful_conversation", 
      name: "Thoughtful Conversation", 
      description: "Reflective, empathetic speaking style",
      prompt: "Person having a thoughtful conversation with reflective pauses, understanding nods, empathetic expressions, and calm, measured movements"
    },
    { 
      id: "telling_story", 
      name: "Telling a Funny Story", 
      description: "Animated storytelling with humor",
      prompt: "Animated storyteller with expressive face, playful gestures, raised eyebrows for emphasis, smiles, and varied expressions as if telling an entertaining story"
    },
  ];
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
  
  // AI script generation settings
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("instagram_reel");
  
  // Activity log state for step-by-step visibility
  const [activityLogs, setActivityLogs] = useState<Array<{
    id: string;
    timestamp: string;
    step: 'upload' | 'group_created' | 'waiting' | 'training_started' | 'training_progress' | 'training_complete' | 'generating_looks' | 'looks_complete' | 'error';
    message: string;
    groupName?: string;
    details?: string;
    previewImage?: string;
  }>>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(true);
  const activityLogRef = useRef<HTMLDivElement>(null);
  
  // Ref to track previous group train statuses for detecting changes
  const previousGroupStatusRef = useRef<Record<string, string>>({});
  // Track groups that have already triggered look generation
  const looksTriggeredRef = useRef<Set<string>>(new Set());

  const { data: avatarGroupsResponse, isLoading: groupsLoading } = useQuery<{
    avatar_group_list?: PhotoAvatarGroup[];
  }>({
    queryKey: ["/api/photo-avatars/groups"],
    // Poll when there are groups NOT ready (empty, pending, processing) 
    // to detect training start and completion
    refetchInterval: (query) => {
      const groups = query.state.data?.avatar_group_list ?? [];
      const hasNonReady = groups.some((g: PhotoAvatarGroup) => {
        const trainStatus = (g.train_status || "").toLowerCase();
        const status = (g.status || "").toLowerCase();
        const numLooks = g.num_looks || 0;
        // Poll if group is not fully ready (empty, pending, processing, or ready with no looks)
        return trainStatus !== 'ready' || (trainStatus === 'ready' && numLooks === 0) ||
               status === 'processing' || status === 'pending';
      });
      return hasNonReady ? 5000 : false;
    },
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

  // ElevenLabs voices query
  interface ElevenLabsVoice {
    id: string;
    name: string;
    category?: string;
    description?: string;
    previewUrl?: string;
  }
  const { data: elevenLabsData } = useQuery<{
    configured: boolean;
    voices: ElevenLabsVoice[];
  }>({
    queryKey: ["/api/elevenlabs/voices"],
  });
  const elevenLabsConfigured = elevenLabsData?.configured ?? false;
  const elevenLabsVoices = elevenLabsData?.voices ?? [];

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

  // Effect to detect training completion and auto-trigger look generation
  useEffect(() => {
    if (!avatarGroups || avatarGroups.length === 0) return;

    const triggerLookGeneration = async (groupId: string, groupName: string, previewImage?: string) => {
      if (looksTriggeredRef.current.has(groupId)) {
        console.log(`⏭️ Looks already triggered for group ${groupId}, skipping`);
        return;
      }
      
      looksTriggeredRef.current.add(groupId);
      
      addActivityLog({
        step: 'generating_looks',
        message: 'Generating professional looks...',
        groupName: groupName,
        details: 'Creating professional and casual avatar looks',
        previewImage: previewImage
      });
      
      try {
        console.log(`🎨 Auto-triggering look generation for group ${groupId}`);
        await apiRequest(
          "POST",
          `/api/photo-avatars/groups/${groupId}/generate-looks`,
          {}
        );
        
        toast({
          title: "Generating Looks",
          description: "Creating professional looks for your avatar. This may take a few minutes.",
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", groupId, "looks"] });
      } catch (error: any) {
        console.error("Look generation failed:", error);
        // Remove from triggered set so it can be retried
        looksTriggeredRef.current.delete(groupId);
        
        addActivityLog({
          step: 'error',
          message: 'Look generation failed',
          groupName: groupName,
          details: error?.message || 'Unknown error',
          previewImage: previewImage
        });
      }
    };

    avatarGroups.forEach((group) => {
      const groupId = group.group_id;
      const currentTrainStatus = (group.train_status || group.status || "").toLowerCase();
      const previousStatus = previousGroupStatusRef.current[groupId];
      const numLooks = group.num_looks || 0;
      const previewImage = group.preview_image;
      
      // Detect training started: status changed to processing
      if (previousStatus && previousStatus !== "processing" && currentTrainStatus === "processing") {
        console.log(`🎓 Training started for group ${groupId}: ${group.name}`);
        
        addActivityLog({
          step: 'training_progress',
          message: 'Training in progress...',
          groupName: group.name,
          details: 'HeyGen is processing your avatar (~5-15 min)',
          previewImage: previewImage
        });
        
        toast({
          title: "Training Started!",
          description: `${group.name} is now training. This takes 5-15 minutes.`,
          duration: 5000,
        });
      }
      
      // Detect training completion: status changed from processing to ready
      if (previousStatus === "processing" && currentTrainStatus === "ready") {
        console.log(`✅ Training completed for group ${groupId}: ${group.name}`);
        
        addActivityLog({
          step: 'training_complete',
          message: 'Training complete!',
          groupName: group.name,
          details: 'Avatar is ready. Now generating professional looks...',
          previewImage: previewImage
        });
        
        toast({
          title: "Training Complete!",
          description: `${group.name} is ready. Generating professional looks...`,
          duration: 5000,
        });
        
        // Auto-trigger look generation
        triggerLookGeneration(groupId, group.name, previewImage);
      }
      
      // Handle ready groups with only original photo on first load (page refresh scenario)
      // If train_status is ready, num_looks is 0 or 1 (just original), and we haven't triggered looks yet
      if (currentTrainStatus === "ready" && numLooks <= 1 && !previousStatus) {
        console.log(`🔄 Ready group with only original photo found on load: ${groupId} - ${group.name} (${numLooks} looks)`);
        // Auto-trigger look generation for ready groups that need additional looks
        triggerLookGeneration(groupId, group.name, previewImage);
      }
      
      // Detect when new looks are generated (num_looks increases from 0 or 1)
      if (currentTrainStatus === "ready" && numLooks > 1) {
        const prevLooksCount = parseInt(previousGroupStatusRef.current[`${groupId}_looks`] || "0", 10);
        if (prevLooksCount <= 1 && numLooks > prevLooksCount) {
          addActivityLog({
            step: 'looks_complete',
            message: 'Looks generated successfully!',
            groupName: group.name,
            details: `${numLooks} look(s) are now available`,
            previewImage: previewImage
          });
          
          toast({
            title: "Looks Ready!",
            description: `${numLooks} professional look(s) created for ${group.name}`,
          });
        }
      }
      previousGroupStatusRef.current[`${groupId}_looks`] = String(numLooks);
      
      // Update previous status for next comparison
      previousGroupStatusRef.current[groupId] = currentTrainStatus;
    });
  }, [avatarGroups, toast]);

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      addActivityLog({
        step: 'upload',
        message: 'Uploading photo...',
        groupName: name,
        details: `File: ${file.name}`
      });
      
      const formData = new FormData();
      formData.append("photo", file);

      const uploadResponse = await fetch("/api/photo-avatars/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");
      const uploadData = await uploadResponse.json();

      addActivityLog({
        step: 'waiting',
        message: 'Creating avatar group...',
        groupName: name,
        details: 'Photo uploaded, now creating your avatar'
      });

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
    onSuccess: async (data) => {
      const groupId = data?.group?.group_id || data?.groupId || data?.group_id || data?.id;
      const groupName = data?.group?.name || data?.name || uploadName || "Avatar";
      
      addActivityLog({
        step: 'group_created',
        message: 'Avatar group created!',
        groupName: groupName,
        details: 'Your avatar is ready for training'
      });
      
      toast({
        title: "Photo Uploaded",
        description: "Avatar group created. Starting training automatically...",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      setShowQuickUpload(false);
      setUploadedFile(null);
      setUploadName("");
      
      if (groupId) {
        setSelectedAvatarGroup(groupId);
        
        addActivityLog({
          step: 'training_started',
          message: 'Training will start shortly...',
          groupName: groupName,
          details: 'HeyGen needs ~20 seconds to process your image before training begins'
        });
        
        toast({
          title: "Avatar Created!",
          description: "Training will start automatically in ~20 seconds. This process takes 5-15 minutes.",
          duration: 8000,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      }
    },
    onError: (error: Error) => {
      addActivityLog({
        step: 'error',
        message: 'Upload failed',
        details: error.message
      });
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Regenerate looks mutation with activity log integration
  const regenerateLooksMutation = useMutation({
    mutationFn: async ({ groupId, groupName, previewImage }: { groupId: string; groupName: string; previewImage?: string }) => {
      addActivityLog({
        step: 'generating_looks',
        message: 'Regenerating professional looks...',
        groupName: groupName,
        details: 'Creating new avatar looks (this may take a few minutes)',
        previewImage: previewImage
      });
      
      const response = await apiRequest(
        "POST",
        `/api/photo-avatars/groups/${groupId}/generate-looks`,
        {}
      );
      return { response: await response.json(), groupName, previewImage };
    },
    onSuccess: ({ groupName, previewImage }) => {
      addActivityLog({
        step: 'looks_complete',
        message: 'Look generation started!',
        groupName: groupName,
        details: 'New looks are being generated. Check back in a few minutes.',
        previewImage: previewImage
      });
      
      toast({
        title: "Generating Looks",
        description: "Creating professional looks for your avatar. This may take a few minutes.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      if (selectedAvatarGroup) {
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"] });
      }
    },
    onError: (error: any, variables) => {
      addActivityLog({
        step: 'error',
        message: 'Look generation failed',
        groupName: variables.groupName,
        details: error?.message || 'Unknown error',
        previewImage: variables.previewImage
      });
      
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to generate looks",
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
      const platform = PLATFORM_OPTIONS.find(p => p.id === selectedPlatform);
      const response = await apiRequest("POST", "/api/generate-script", {
        topic: videoTitle || "professional real estate introduction",
        videoType: "introduction",
        platform: platform?.name || "Instagram Reel",
        duration: platform?.duration || 30,
        customPrompt: customPrompt || undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setScript(data.script || "");
      toast({
        title: "Script Generated!",
        description: `Created a ${PLATFORM_OPTIONS.find(p => p.id === selectedPlatform)?.duration || 30}-second script for ${PLATFORM_OPTIONS.find(p => p.id === selectedPlatform)?.name || 'your video'}.`,
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

  const deleteAvatarLookMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const response = await fetch(`/api/photo-avatars/${avatarId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete avatar look");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar Look Deleted",
        description: "The avatar look has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatar-groups", selectedAvatarGroup, "looks"] });
      if (selectedAvatarLook && deleteAvatarLookMutation.variables === selectedAvatarLook) {
        setSelectedAvatarLook("");
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

  // Motion video generation using HeyGen API
  const handleGenerateMotion = async () => {
    if (!motionPrompt.trim()) {
      toast({
        title: "Enter a prompt",
        description: "Please describe how you want your avatar to move.",
        variant: "destructive",
      });
      return;
    }

    const currentLook = availableLooks[popupLookIndex];
    const avatarId = currentLook?.id || currentLook?.avatar_id;
    
    if (!avatarId) {
      toast({
        title: "No avatar selected",
        description: "Please select an avatar look first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingMotion(true);
    setMotionStatus("starting");
    setMotionProgress(0);
    setMotionVideoUrl(null);

    // Demo mode: use pre-recorded video with simulated progress
    if (isDemo) {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        setMotionProgress(Math.min(progress, 90));
        setMotionStatus("processing");
      }, 200);

      setTimeout(() => {
        clearInterval(progressInterval);
        setMotionVideoUrl(demoMotionVideo);
        setMotionStatus("completed");
        setMotionProgress(100);
        setIsGeneratingMotion(false);
        setMotionDialogStep("voice");
        toast({
          title: "Motion Video Ready!",
          description: "Demo: Now add your voice to make your avatar speak.",
        });
      }, 2500);
      return;
    }

    try {
      // Use HeyGen's add_motion API instead of Kling
      const response = await fetch(`/api/photo-avatars/${avatarId}/add-motion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: motionPrompt,
          motionType: "consistent",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Failed to start motion generation");
      }

      // HeyGen returns a motion job ID, poll for completion
      setMotionTaskId(avatarId);
      setMotionStatus("processing");
      pollHeyGenMotionStatus(avatarId);
    } catch (error) {
      console.error("Motion generation error:", error);
      setMotionStatus("failed");
      setIsGeneratingMotion(false);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate motion video",
        variant: "destructive",
      });
    }
  };

  // Poll HeyGen avatar status for motion completion
  const pollHeyGenMotionStatus = async (avatarId: string) => {
    const maxPolls = 60;
    let pollCount = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/photo-avatars/${avatarId}/status`, {
          credentials: "include",
        });

        const result = await response.json();
        pollCount++;

        setMotionProgress(Math.min(95, Math.round((pollCount / maxPolls) * 100)));

        // Check if motion is ready and has preview URL
        if (result.is_motion && result.motion_preview_url) {
          setMotionVideoUrl(result.motion_preview_url);
          setMotionStatus("completed");
          setMotionProgress(100);
          setIsGeneratingMotion(false);
          setMotionDialogStep("voice");
          // Refresh avatar looks to update UI
          queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"] });
          toast({
            title: "Motion Video Ready!",
            description: "Now add your voice to make your avatar speak.",
          });
          return;
        }

        if (result.status === "failed" || result.error) {
          setMotionStatus("failed");
          setIsGeneratingMotion(false);
          toast({
            title: "Generation Failed",
            description: result.error || "Video generation failed",
            variant: "destructive",
          });
          return;
        }

        // If motion not ready yet, keep polling
        if (pollCount < maxPolls && !result.is_motion) {
          setMotionStatus("processing");
          setTimeout(poll, 3000);
        } else if (pollCount >= maxPolls) {
          setMotionStatus("timeout");
          setIsGeneratingMotion(false);
          toast({
            title: "Generation Timeout",
            description: "Video is still processing. Please check back later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Poll error:", error);
        setMotionStatus("failed");
        setIsGeneratingMotion(false);
      }
    };

    poll();
  };

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

  const startMotionRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      motionMediaRecorderRef.current = mediaRecorder;
      motionChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          motionChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(motionChunksRef.current, { type: "audio/webm" });
        setMotionRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setMotionRecordedUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsMotionRecording(true);
      setMotionRecordingTime(0);

      motionRecordingIntervalRef.current = setInterval(() => {
        setMotionRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record your voice.",
        variant: "destructive",
      });
    }
  };

  const stopMotionRecording = () => {
    if (motionMediaRecorderRef.current && isMotionRecording) {
      motionMediaRecorderRef.current.stop();
      setIsMotionRecording(false);
      if (motionRecordingIntervalRef.current) {
        clearInterval(motionRecordingIntervalRef.current);
        motionRecordingIntervalRef.current = null;
      }
    }
  };

  const clearMotionRecording = () => {
    setMotionRecordedBlob(null);
    setMotionRecordedUrl("");
    setMotionRecordingTime(0);
  };

  const handleUploadMotionVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast({
          title: "Invalid File",
          description: "Please upload a video file (MP4, WebM, etc.)",
          variant: "destructive",
        });
        return;
      }
      setUploadedMotionFile(file);
      const url = URL.createObjectURL(file);
      setUploadedMotionUrl(url);
      setMotionVideoUrl(url);
      setMotionDialogStep("voice");
      toast({
        title: "Motion Video Uploaded",
        description: "Now add your voice to make your avatar speak.",
      });
    }
  };

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast({
          title: "Invalid File",
          description: "Please upload an audio file (MP3, WAV, etc.)",
          variant: "destructive",
        });
        return;
      }
      setUploadedAudioFile(file);
      const url = URL.createObjectURL(file);
      setUploadedAudioUrl(url);
      toast({
        title: "Audio Uploaded",
        description: "Your audio file is ready to use.",
      });
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

  // Helper to add activity log entry
  const addActivityLog = (log: Omit<typeof activityLogs[0], 'id' | 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setActivityLogs(prev => [...prev.slice(-30), { ...log, id, timestamp }]);
    setTimeout(() => {
      if (activityLogRef.current) {
        activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
      }
    }, 100);
  };
  
  // Helper to get step icon and color
  const getStepStyle = (step: typeof activityLogs[0]['step']) => {
    switch (step) {
      case 'upload':
        return { icon: Upload, color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'group_created':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' };
      case 'waiting':
        return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' };
      case 'training_started':
        return { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'training_progress':
        return { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'training_complete':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' };
      case 'generating_looks':
        return { icon: Wand2, color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'looks_complete':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' };
      default:
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50' };
    }
  };

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
    <div className="flex gap-4" data-testid="avatar-studio">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-[#D4AF37]" />
                Avatar Studio
              </CardTitle>
              <CardDescription>
                Create professional AI avatar videos in 3 simple steps
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActivityPanel(!showActivityPanel)}
              className="flex items-center gap-1"
              data-testid="button-toggle-activity-log"
            >
              <Terminal className="w-4 h-4" />
              {showActivityPanel ? 'Hide' : 'Show'} Log
            </Button>
          </div>
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
                        {group.preview_image ? (
                          <img 
                            src={group.preview_image} 
                            alt={group.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <User className={`h-12 w-12 text-gray-400 ${group.preview_image ? 'hidden' : ''}`} />
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

              {/* Regenerate Looks button for selected group */}
              {selectedAvatarGroup && selectedGroup && selectedGroup.train_status === "ready" && (
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      regenerateLooksMutation.mutate({
                        groupId: selectedAvatarGroup,
                        groupName: selectedGroup.name,
                        previewImage: selectedGroup.preview_image
                      });
                    }}
                    disabled={regenerateLooksMutation.isPending}
                    className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    data-testid="button-regenerate-looks"
                  >
                    {regenerateLooksMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate Looks
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-gray-500">
                    Generate new professional looks for this avatar
                  </span>
                </div>
              )}

              {selectedAvatarGroup && availableLooks.length > 0 && (
                <div className="mt-6">
                  <Label className="text-sm font-medium mb-3 block">
                    Select an Avatar Look <span className="text-gray-400 font-normal">(click to preview, double-click to select)</span>
                  </Label>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {availableLooks.map((look, index) => {
                      const lookId = look.avatar_id || look.id;
                      const imageUrl = look.image_url || look.image || "";
                      const hasMotion = look.is_motion && look.motion_preview_url;
                      const isHovered = hoveredLookId === lookId;
                      
                      return (
                        <button
                          key={lookId}
                          onClick={() => {
                            setPopupLookIndex(index);
                            setSelectedAvatarLook(lookId);
                            setShowLookPopup(true);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setSelectedAvatarLook(lookId);
                            setShowLookPopup(false);
                            toast({
                              title: "Avatar Selected",
                              description: "Now proceed to choose a voice for your video.",
                            });
                          }}
                          onMouseEnter={() => setHoveredLookId(lookId)}
                          onMouseLeave={() => setHoveredLookId(null)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-lg ${
                            selectedAvatarLook === lookId
                              ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                          }`}
                          data-testid={`avatar-look-${lookId}`}
                        >
                          {/* Selected indicator */}
                          {selectedAvatarLook === lookId && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center z-10">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          
                          {/* Motion badge */}
                          {hasMotion && (
                            <div className="absolute top-1 left-1 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
                              <Play className="h-2.5 w-2.5" />
                              Motion
                            </div>
                          )}
                          
                          {/* Delete button */}
                          {isHovered && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this avatar look? This cannot be undone.")) {
                                  deleteAvatarLookMutation.mutate(lookId);
                                }
                              }}
                              disabled={deleteAvatarLookMutation.isPending}
                              className="absolute bottom-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-10 transition-colors"
                              data-testid={`button-delete-look-${lookId}`}
                            >
                              <Trash2 className="h-3 w-3 text-white" />
                            </button>
                          )}
                          
                          {/* Image or Video on hover */}
                          {hasMotion && isHovered ? (
                            <video
                              src={look.motion_preview_url}
                              className="w-full aspect-square object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={imageUrl}
                              alt={look.name || `Look ${lookId}`}
                              className="w-full aspect-square object-cover"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedAvatarGroup && availableLooks.length === 0 && (
                <div className="text-center py-6 text-gray-500 border rounded-lg mt-4">
                  {selectedGroup?.train_status === "ready" ? (
                    <>
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No looks found for this avatar. Try refreshing or check HeyGen dashboard.</p>
                    </>
                  ) : selectedGroup?.train_status === "processing" || selectedGroup?.train_status === "training" ? (
                    <>
                      <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                      <p>Training in progress. Looks will appear when complete.</p>
                    </>
                  ) : (
                    <>
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>Loading looks...</p>
                    </>
                  )}
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

              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-[#D4AF37]" />
                  <h4 className="font-medium">AI Script Generator</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform-select">Platform</Label>
                    <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                      <SelectTrigger id="platform-select" data-testid="select-platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id}>
                            <div className="flex flex-col">
                              <span>{platform.name}</span>
                              <span className="text-xs text-gray-500">{platform.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-500">Target Duration</Label>
                    <div className="h-10 flex items-center px-3 border rounded-md bg-white dark:bg-gray-700 text-sm">
                      {PLATFORM_OPTIONS.find(p => p.id === selectedPlatform)?.duration || 30} seconds
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-prompt">Custom Instructions (optional)</Label>
                  <Textarea
                    id="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., Focus on luxury homes in West Omaha, mention our 20 years of experience..."
                    rows={2}
                    className="resize-none"
                    data-testid="input-custom-prompt"
                  />
                </div>
                
                <Button
                  onClick={() => generateScriptMutation.mutate()}
                  disabled={generateScriptMutation.isPending}
                  className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  data-testid="button-ai-assist"
                >
                  {generateScriptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Script with AI
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script">Script</Label>
                <Textarea
                  id="script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter what your avatar will say, or use AI to generate a script above..."
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

      <Dialog open={showLookPopup} onOpenChange={setShowLookPopup}>
        <DialogContent 
          className="max-w-lg p-0 gap-0 overflow-hidden bg-white dark:bg-gray-900 rounded-2xl"
          data-testid="dialog-avatar-look-popup"
        >
          {availableLooks.length > 0 && availableLooks[popupLookIndex] && (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <DialogTitle className="text-lg font-semibold">
                  {selectedGroup?.name || "Avatar Look"} - Look {popupLookIndex + 1}
                </DialogTitle>
              </div>

              <div className="relative flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                {availableLooks.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newIndex = popupLookIndex === 0 ? availableLooks.length - 1 : popupLookIndex - 1;
                      setPopupLookIndex(newIndex);
                      const prevLook = availableLooks[newIndex];
                      setSelectedAvatarLook(prevLook?.avatar_id || prevLook?.id || "");
                    }}
                    className="absolute left-4 z-10 h-10 w-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border-gray-200"
                    data-testid="button-prev-look"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                <div className="p-6">
                  <div className="w-72 h-96 mx-auto rounded-xl overflow-hidden shadow-lg border-2 border-gray-100 dark:border-gray-700 relative">
                    {/* Motion badge in popup */}
                    {availableLooks[popupLookIndex]?.is_motion && availableLooks[popupLookIndex]?.motion_preview_url && (
                      <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10">
                        <Play className="h-3 w-3" />
                        Motion Avatar
                      </div>
                    )}
                    
                    {/* Show motion video if available, otherwise show image */}
                    {availableLooks[popupLookIndex]?.is_motion && availableLooks[popupLookIndex]?.motion_preview_url ? (
                      <video
                        src={availableLooks[popupLookIndex].motion_preview_url}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        data-testid="video-popup-avatar"
                      />
                    ) : (
                      <img
                        src={availableLooks[popupLookIndex]?.image_url || availableLooks[popupLookIndex]?.image || ""}
                        alt={availableLooks[popupLookIndex]?.name || `Avatar Look ${popupLookIndex + 1}`}
                        className="w-full h-full object-cover"
                        data-testid="img-popup-avatar"
                      />
                    )}
                  </div>
                </div>

                {availableLooks.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newIndex = popupLookIndex === availableLooks.length - 1 ? 0 : popupLookIndex + 1;
                      setPopupLookIndex(newIndex);
                      const nextLook = availableLooks[newIndex];
                      setSelectedAvatarLook(nextLook?.avatar_id || nextLook?.id || "");
                    }}
                    className="absolute right-4 z-10 h-10 w-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border-gray-200"
                    data-testid="button-next-look"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 px-6 py-4 border-t bg-white dark:bg-gray-900">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-purple-300 hover:bg-purple-50 text-purple-700"
                  onClick={() => {
                    setShowMotionDialog(true);
                    setMotionTab("templates");
                    setSelectedMotionTemplate("talking_naturally");
                    const defaultTemplate = MOTION_TEMPLATES.find(t => t.id === "talking_naturally");
                    setMotionPrompt(defaultTemplate?.prompt || "");
                    setMotionStatus("");
                    setMotionVideoUrl(null);
                    setMotionProgress(0);
                    setMotionDialogStep("motion");
                    setMotionVoiceScript("");
                    setSelectedMotionVoice("119caed25533477ba63822d5d1552d25");
                    setLipSyncStatus("");
                    setLipSyncProgress(0);
                    setFinalVideoUrl(null);
                  }}
                  data-testid="button-add-motion"
                >
                  <Sparkles className="h-4 w-4" />
                  Add Motion
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    if (isDemo) {
                      setShowEditLookResult(true);
                    } else {
                      toast({
                        title: "Coming Soon",
                        description: "Look editing will be available in a future update.",
                      });
                    }
                  }}
                  data-testid="button-edit-look"
                >
                  <RefreshCw className="h-4 w-4" />
                  Edit Look
                </Button>
                <Button
                  className="btn-golden flex items-center gap-2 relative overflow-hidden"
                  onClick={() => {
                    setShowLookPopup(false);
                    toast({
                      title: "Avatar Selected",
                      description: "Now proceed to choose a voice for your video.",
                    });
                  }}
                  data-testid="button-select-avatar"
                >
                  <Video className="h-4 w-4" />
                  Create with AI Studio
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Motion Generation Dialog - Multi-step: Motion → Voice → Final */}
      <Dialog open={showMotionDialog} onOpenChange={setShowMotionDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {motionDialogStep === "motion" && "Step 1: Add Motion"}
              {motionDialogStep === "voice" && "Step 2: Add Voice"}
              {motionDialogStep === "final" && "Step 3: Preview Video"}
            </DialogTitle>
            <DialogDescription>
              {motionDialogStep === "motion" && "Transform your image into a video with natural motion."}
              {motionDialogStep === "voice" && "Add your voice and script to bring your avatar to life."}
              {motionDialogStep === "final" && "Your talking avatar video is ready!"}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-2">
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              motionDialogStep === "motion" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
            }`}>
              {motionDialogStep !== "motion" ? <CheckCircle className="h-3 w-3" /> : <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">1</span>}
              Motion
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              motionDialogStep === "voice" ? "bg-purple-100 text-purple-700" : 
              motionDialogStep === "final" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {motionDialogStep === "final" ? <CheckCircle className="h-3 w-3" /> : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                motionDialogStep === "voice" ? "bg-purple-500 text-white" : "bg-gray-300 text-gray-600"
              }`}>2</span>}
              Voice
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              motionDialogStep === "final" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                motionDialogStep === "final" ? "bg-purple-500 text-white" : "bg-gray-300 text-gray-600"
              }`}>3</span>
              Preview
            </div>
          </div>

          {/* STEP 1: Motion Selection */}
          {motionDialogStep === "motion" && (
            <>
              <div className="flex gap-6 py-4">
                {/* Left side: Avatar Preview */}
                <div className="flex-shrink-0">
                  <div className="w-48 h-64 rounded-lg overflow-hidden border-2 border-cyan-400 shadow-lg bg-gradient-to-b from-cyan-50 to-white dark:from-cyan-950/30 dark:to-gray-900">
                    <img
                      src={availableLooks[popupLookIndex]?.image_url || availableLooks[popupLookIndex]?.image || ""}
                      alt="Selected Avatar"
                      className="w-full h-full object-cover"
                      data-testid="img-motion-preview"
                    />
                  </div>
                </div>

                {/* Right side: Options */}
                <div className="flex-1 space-y-4">
                  <Tabs value={motionTab} onValueChange={(v) => setMotionTab(v as "templates" | "custom" | "upload")} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger 
                        value="templates" 
                        className="data-[state=active]:text-cyan-600 data-[state=active]:border-b-2 data-[state=active]:border-cyan-500"
                        data-testid="tab-motion-templates"
                      >
                        Templates
                      </TabsTrigger>
                      <TabsTrigger 
                        value="custom"
                        data-testid="tab-custom-prompt"
                      >
                        Custom
                      </TabsTrigger>
                      <TabsTrigger 
                        value="upload"
                        data-testid="tab-upload-motion"
                      >
                        Upload Video
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="templates" className="mt-0">
                      <ScrollArea className="h-[200px] pr-4">
                        <div className="space-y-2">
                          {MOTION_TEMPLATES.map((template) => (
                            <div
                              key={template.id}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                                selectedMotionTemplate === template.id
                                  ? "bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                              }`}
                              onClick={() => {
                                setSelectedMotionTemplate(template.id);
                                setMotionPrompt(template.prompt);
                              }}
                              data-testid={`template-${template.id}`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{template.name}</span>
                                  {template.id === "talking_naturally" && (
                                    <span className="text-xs text-gray-500">(Default)</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                              </div>
                              {selectedMotionTemplate === template.id && (
                                <CheckCircle className="h-5 w-5 text-cyan-500 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="custom" className="mt-0">
                      <Textarea
                        id="motion-prompt"
                        placeholder="Describe how you want your avatar to move..."
                        value={motionPrompt}
                        onChange={(e) => {
                          setMotionPrompt(e.target.value);
                          setSelectedMotionTemplate("");
                        }}
                        className="min-h-[180px]"
                        disabled={isGeneratingMotion || motionStatus === "processing"}
                        data-testid="input-motion-prompt"
                      />
                    </TabsContent>

                    <TabsContent value="upload" className="mt-0">
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900 min-h-[180px]">
                        {!uploadedMotionUrl ? (
                          <>
                            <Video className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                              Already have a motion video?
                              <br />Upload it and skip directly to adding voice.
                            </p>
                            <Label 
                              htmlFor="motion-video-upload" 
                              className="cursor-pointer bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
                            >
                              <Upload className="h-4 w-4" />
                              Choose Video File
                            </Label>
                            <input
                              id="motion-video-upload"
                              type="file"
                              accept="video/*"
                              onChange={handleUploadMotionVideo}
                              className="hidden"
                              data-testid="input-upload-motion-video"
                            />
                            <p className="text-xs text-gray-500 mt-3">
                              Supports MP4, WebM, MOV formats
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-green-600 mb-4">
                              <CheckCircle className="h-5 w-5" />
                              <span className="font-medium">Video uploaded: {uploadedMotionFile?.name}</span>
                            </div>
                            <video 
                              src={uploadedMotionUrl} 
                              controls 
                              className="w-full max-w-xs rounded-lg mb-4"
                              data-testid="video-uploaded-motion"
                            />
                            <Button
                              variant="outline"
                              onClick={() => {
                                setUploadedMotionFile(null);
                                setUploadedMotionUrl("");
                                setMotionVideoUrl(null);
                              }}
                              data-testid="button-remove-motion-video"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove & Choose Another
                            </Button>
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Duration</Label>
                      <Select
                        value={motionDuration}
                        onValueChange={(value) => setMotionDuration(value as "5" | "10")}
                        disabled={isGeneratingMotion || motionStatus === "processing"}
                      >
                        <SelectTrigger className="w-28 h-8 text-sm" data-testid="select-motion-duration">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 sec</SelectItem>
                          <SelectItem value="10">10 sec</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress indicator */}
              {(isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending") && (
                <div className="space-y-2 px-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {motionStatus === "starting" && "Starting generation..."}
                      {motionStatus === "pending" && "Queued for processing..."}
                      {motionStatus === "processing" && "Creating motion video..."}
                    </span>
                    <span className="text-purple-600 font-medium">{motionProgress}%</span>
                  </div>
                  <Progress value={motionProgress} className="h-2" />
                  <p className="text-xs text-gray-500 text-center">
                    This may take 1-3 minutes. Please wait...
                  </p>
                </div>
              )}

              {/* Error state */}
              {motionStatus === "failed" && (
                <div className="flex items-center gap-2 p-3 mx-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-400">
                    Video generation failed. Please try again with a different prompt.
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowMotionDialog(false)}
                  data-testid="button-cancel-motion"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-purple-500 hover:bg-purple-600 text-white"
                  onClick={handleGenerateMotion}
                  disabled={isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending" || !motionPrompt.trim()}
                  data-testid="button-generate-motion"
                >
                  {isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Motion
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* STEP 2: Voice Selection */}
          {motionDialogStep === "voice" && (
            <>
              <div className="space-y-4 py-4">
                {/* Motion video preview (small) */}
                <div className="flex gap-4 items-start">
                  <div className="w-32 h-20 rounded-lg overflow-hidden border bg-black flex-shrink-0">
                    <video
                      src={motionVideoUrl || ""}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Motion video ready
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Now add your voice to make your avatar speak.</p>
                  </div>
                </div>

                {/* Voice Input Mode Toggle */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">How do you want to add voice?</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={voiceInputMode === "tts" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoiceInputMode("tts")}
                      className={voiceInputMode === "tts" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="button-voice-mode-tts"
                    >
                      <Volume2 className="h-4 w-4 mr-1" />
                      Text to Speech
                    </Button>
                    <Button
                      variant={voiceInputMode === "record" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoiceInputMode("record")}
                      className={voiceInputMode === "record" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="button-voice-mode-record"
                    >
                      <Mic className="h-4 w-4 mr-1" />
                      Record Voice
                    </Button>
                    <Button
                      variant={voiceInputMode === "upload" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoiceInputMode("upload")}
                      className={voiceInputMode === "upload" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="button-voice-mode-upload"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Audio
                    </Button>
                  </div>
                </div>

                {/* TTS Mode */}
                {voiceInputMode === "tts" && (
                  <>
                    {/* Voice Provider Toggle */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Voice Provider</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={voiceProvider === "elevenlabs" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setVoiceProvider("elevenlabs");
                            if (elevenLabsVoices.length > 0) {
                              setSelectedMotionVoice(elevenLabsVoices[0].id);
                            }
                          }}
                          className={voiceProvider === "elevenlabs" ? "bg-blue-600 hover:bg-blue-700" : ""}
                          data-testid="button-voice-elevenlabs"
                        >
                          <Volume2 className="h-4 w-4 mr-1" />
                          ElevenLabs {elevenLabsConfigured && "(Connected)"}
                        </Button>
                        <Button
                          variant={voiceProvider === "kling" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setVoiceProvider("kling");
                            setSelectedMotionVoice(KLING_VOICES[0].id);
                          }}
                          data-testid="button-voice-kling"
                        >
                          <Mic className="h-4 w-4 mr-1" />
                          Built-in
                        </Button>
                      </div>
                      {voiceProvider === "elevenlabs" && !elevenLabsConfigured && (
                        <p className="text-xs text-amber-600">
                          ElevenLabs API key is being configured. Using default voices.
                        </p>
                      )}
                    </div>

                    {/* Voice Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Select Voice</Label>
                      <Select value={selectedMotionVoice} onValueChange={setSelectedMotionVoice}>
                        <SelectTrigger data-testid="select-motion-voice">
                          <SelectValue placeholder="Choose a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceProvider === "elevenlabs" ? (
                            <>
                              {elevenLabsVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name} {voice.description ? `- ${voice.description}` : ""}
                                </SelectItem>
                              ))}
                            </>
                          ) : (
                            <>
                              {KLING_VOICES.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {customVoices?.map((voice: CustomVoice) => (
                            <SelectItem key={voice.id} value={voice.heygenAudioAssetId || voice.id}>
                              {voice.name} (Custom)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Script Input */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">What should your avatar say?</Label>
                      <Textarea
                        placeholder="Enter the script for your avatar to speak... For best results, keep it under 100 words for a 5-10 second video."
                        value={motionVoiceScript}
                        onChange={(e) => setMotionVoiceScript(e.target.value)}
                        className="min-h-[120px]"
                        disabled={isGeneratingLipSync}
                        data-testid="input-motion-script"
                      />
                      <p className="text-xs text-gray-500">
                        {motionVoiceScript.split(/\s+/).filter(Boolean).length} words
                      </p>
                    </div>
                  </>
                )}

                {/* Record Mode */}
                {voiceInputMode === "record" && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900">
                      {!motionRecordedUrl ? (
                        <>
                          <div 
                            className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${
                              isMotionRecording 
                                ? "bg-red-500 animate-pulse" 
                                : "bg-purple-100 dark:bg-purple-900"
                            }`}
                          >
                            <Mic className={`h-10 w-10 ${isMotionRecording ? "text-white" : "text-purple-600"}`} />
                          </div>
                          {isMotionRecording && (
                            <div className="text-2xl font-mono text-red-500 mb-4">
                              {formatTime(motionRecordingTime)}
                            </div>
                          )}
                          <Button
                            onClick={isMotionRecording ? stopMotionRecording : startMotionRecording}
                            className={isMotionRecording 
                              ? "bg-red-500 hover:bg-red-600" 
                              : "bg-purple-500 hover:bg-purple-600"}
                            data-testid={isMotionRecording ? "button-stop-motion-recording" : "button-start-motion-recording"}
                          >
                            {isMotionRecording ? (
                              <>
                                <Square className="h-4 w-4 mr-2" />
                                Stop Recording
                              </>
                            ) : (
                              <>
                                <Mic className="h-4 w-4 mr-2" />
                                Start Recording
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-gray-500 mt-3 text-center">
                            Record your voice speaking what you want the avatar to say.
                            <br />Keep it under 30 seconds for best results.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Recording saved ({formatTime(motionRecordingTime)})</span>
                          </div>
                          <audio 
                            src={motionRecordedUrl} 
                            controls 
                            className="w-full max-w-xs mb-4"
                            data-testid="audio-motion-recording"
                          />
                          <Button
                            variant="outline"
                            onClick={clearMotionRecording}
                            data-testid="button-clear-motion-recording"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Record Again
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Upload Audio Mode */}
                {voiceInputMode === "upload" && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900">
                      {!uploadedAudioUrl ? (
                        <>
                          <Upload className="h-10 w-10 text-gray-400 mb-4" />
                          <Label 
                            htmlFor="audio-upload" 
                            className="cursor-pointer bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md"
                          >
                            Choose Audio File
                          </Label>
                          <input
                            id="audio-upload"
                            type="file"
                            accept="audio/*"
                            onChange={handleUploadAudio}
                            className="hidden"
                            data-testid="input-upload-audio"
                          />
                          <p className="text-xs text-gray-500 mt-3 text-center">
                            Upload an MP3, WAV, or other audio file.
                            <br />This will be synced to your avatar's lip movements.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Audio uploaded: {uploadedAudioFile?.name}</span>
                          </div>
                          <audio 
                            src={uploadedAudioUrl} 
                            controls 
                            className="w-full max-w-xs mb-4"
                            data-testid="audio-uploaded"
                          />
                          <Button
                            variant="outline"
                            onClick={() => {
                              setUploadedAudioFile(null);
                              setUploadedAudioUrl("");
                            }}
                            data-testid="button-remove-audio"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove & Choose Another
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Lip-sync progress */}
                {(isGeneratingLipSync || lipSyncStatus === "processing" || lipSyncStatus === "pending") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Adding voice to video...
                      </span>
                      <span className="text-purple-600 font-medium">{lipSyncProgress}%</span>
                    </div>
                    <Progress value={lipSyncProgress} className="h-2" />
                  </div>
                )}

                {lipSyncStatus === "failed" && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-400">
                      Failed to add voice. Please try again.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setMotionDialogStep("motion")}
                  data-testid="button-back-to-motion"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  {/* Save Motion Video - allows saving without voice */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (motionVideoUrl) {
                        const link = document.createElement("a");
                        link.href = motionVideoUrl;
                        link.download = `motion-avatar-${Date.now()}.mp4`;
                        link.target = "_blank";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast({
                          title: "Download Started",
                          description: "Your motion video is being downloaded.",
                        });
                      }
                    }}
                    data-testid="button-save-motion"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Save Motion
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMotionDialogStep("final");
                      setFinalVideoUrl(motionVideoUrl);
                    }}
                    data-testid="button-skip-voice"
                  >
                    Skip Voice
                  </Button>
                  <Button
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                    onClick={async () => {
                      // Validate based on voice input mode
                      if (voiceInputMode === "tts" && !motionVoiceScript.trim()) {
                        toast({
                          title: "Enter a script",
                          description: "Please write what you want your avatar to say.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (voiceInputMode === "record" && !motionRecordedBlob) {
                        toast({
                          title: "Record your voice",
                          description: "Please record your voice before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (voiceInputMode === "upload" && !uploadedAudioFile) {
                        toast({
                          title: "Upload an audio file",
                          description: "Please upload an audio file before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (!motionVideoUrl) {
                        toast({
                          title: "No motion video",
                          description: "Please generate a motion video first before adding voice.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      setIsGeneratingLipSync(true);
                      setLipSyncStatus("processing");
                      setLipSyncProgress(10);
                      
                      console.log("🎤 Starting lip-sync request with:", {
                        videoUrl: typeof motionVideoUrl === 'string' ? motionVideoUrl.substring(0, 50) : motionVideoUrl,
                        text: voiceInputMode === "tts" ? motionVoiceScript?.substring(0, 50) : "(audio mode)",
                        voiceInputMode,
                        voiceProvider,
                      });
                      
                      // Demo mode: skip API calls and use demo video
                      if (isDemo) {
                        let progress = 10;
                        const progressInterval = setInterval(() => {
                          progress += 15;
                          setLipSyncProgress(Math.min(progress, 90));
                        }, 300);

                        setTimeout(() => {
                          clearInterval(progressInterval);
                          setFinalVideoUrl(demoFinalVideo);
                          setLipSyncStatus("completed");
                          setLipSyncProgress(100);
                          setIsGeneratingLipSync(false);
                          setMotionDialogStep("final");
                          toast({
                            title: "Video Ready!",
                            description: "Demo: Your avatar is now speaking with your voice.",
                          });
                        }, 2000);
                        return;
                      }
                      
                      try {
                        let audioUrl: string | undefined;
                        
                        // Handle different voice input modes
                        if (voiceInputMode === "record" && motionRecordedBlob) {
                          console.log("🎙️ Uploading recorded audio...");
                          setLipSyncProgress(15);
                          
                          const formData = new FormData();
                          formData.append("audio", motionRecordedBlob, "recording.webm");
                          
                          const uploadResponse = await fetch("/api/kling/upload-audio", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          
                          const uploadResult = await uploadResponse.json();
                          console.log("🎙️ Audio upload result:", uploadResult);
                          
                          if (!uploadResponse.ok || !uploadResult.audioUrl) {
                            throw new Error(uploadResult.error || "Failed to upload recorded audio");
                          }
                          
                          audioUrl = uploadResult.audioUrl;
                          setLipSyncProgress(30);
                          console.log("✅ Recorded audio uploaded:", audioUrl);
                        } else if (voiceInputMode === "upload" && uploadedAudioFile) {
                          console.log("🎙️ Uploading audio file...");
                          setLipSyncProgress(15);
                          
                          const formData = new FormData();
                          formData.append("audio", uploadedAudioFile);
                          
                          const uploadResponse = await fetch("/api/kling/upload-audio", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          
                          const uploadResult = await uploadResponse.json();
                          console.log("🎙️ Audio upload result:", uploadResult);
                          
                          if (!uploadResponse.ok || !uploadResult.audioUrl) {
                            throw new Error(uploadResult.error || "Failed to upload audio file");
                          }
                          
                          audioUrl = uploadResult.audioUrl;
                          setLipSyncProgress(30);
                          console.log("✅ Audio file uploaded:", audioUrl);
                        } else if (voiceInputMode === "tts" && voiceProvider === "elevenlabs") {
                          console.log("🎙️ Generating ElevenLabs audio first...");
                          setLipSyncProgress(15);
                          
                          const ttsResponse = await fetch("/api/elevenlabs/tts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              text: motionVoiceScript,
                              voiceId: selectedMotionVoice,
                            }),
                          });
                          
                          const ttsResult = await ttsResponse.json();
                          console.log("🎙️ ElevenLabs TTS result:", ttsResult);
                          
                          if (!ttsResponse.ok || !ttsResult.audioUrl) {
                            throw new Error(ttsResult.error || "Failed to generate audio with ElevenLabs");
                          }
                          
                          audioUrl = ttsResult.audioUrl;
                          setLipSyncProgress(30);
                          console.log("✅ ElevenLabs audio generated:", audioUrl);
                        }
                        
                        console.log("🎤 Sending fetch request to /api/kling/lip-sync");
                        
                        // If motionVideoUrl is a blob URL (from direct upload), we need to upload it to S3 first
                        let finalVideoUrl = motionVideoUrl;
                        if (motionVideoUrl?.startsWith("blob:") && uploadedMotionFile) {
                          console.log("🎬 Uploading motion video to S3 (blob URL detected)...");
                          setLipSyncProgress(35);
                          
                          const videoFormData = new FormData();
                          videoFormData.append("video", uploadedMotionFile);
                          
                          const videoUploadResponse = await fetch("/api/kling/upload-video", {
                            method: "POST",
                            credentials: "include",
                            body: videoFormData,
                          });
                          
                          const videoUploadResult = await videoUploadResponse.json();
                          console.log("🎬 Video upload result:", videoUploadResult);
                          
                          if (!videoUploadResponse.ok || !videoUploadResult.videoUrl) {
                            throw new Error(videoUploadResult.error || "Failed to upload motion video");
                          }
                          
                          finalVideoUrl = videoUploadResult.videoUrl;
                          setLipSyncProgress(45);
                          console.log("✅ Motion video uploaded to S3:", finalVideoUrl);
                        }
                        
                        const lipSyncBody: Record<string, unknown> = {
                          videoUrl: finalVideoUrl,
                        };
                        
                        // Use audio2video mode for record, upload, or ElevenLabs TTS
                        if (audioUrl) {
                          lipSyncBody.mode = "audio2video";
                          lipSyncBody.audioUrl = audioUrl;
                        } else {
                          // Fall back to Kling TTS (text2video mode)
                          lipSyncBody.mode = "text2video";
                          lipSyncBody.text = motionVoiceScript.trim();
                          lipSyncBody.voiceId = selectedMotionVoice || "female_calm";
                        }
                        
                        console.log("🎤 Lip-sync request body:", lipSyncBody);
                        
                        const response = await fetch("/api/kling/lip-sync", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify(lipSyncBody),
                        });
                        
                        console.log("🎤 Response status:", response.status, response.statusText);
                        const result = await response.json();
                        console.log("🎤 Response result:", result);
                        
                        if (!response.ok) {
                          throw new Error(result.error || "Failed to add voice");
                        }
                        
                        if (result.videoUrl) {
                          setFinalVideoUrl(result.videoUrl);
                          setLipSyncStatus("completed");
                          setIsGeneratingLipSync(false);
                          setMotionDialogStep("final");
                          toast({
                            title: "Video Ready!",
                            description: "Your avatar is now speaking with your voice.",
                          });
                        } else if (result.taskId) {
                          setLipSyncTaskId(result.taskId);
                          let pollCount = 0;
                          const maxPolls = 60;
                          
                          const pollInterval = setInterval(async () => {
                            try {
                              pollCount++;
                              const statusRes = await fetch(`/api/kling/lip-sync/${result.taskId}`, {
                                credentials: "include",
                              });
                              const statusData = await statusRes.json();
                              
                              if (statusData.status === "completed" && statusData.videoUrl) {
                                clearInterval(pollInterval);
                                setFinalVideoUrl(statusData.videoUrl);
                                setLipSyncStatus("completed");
                                setLipSyncProgress(100);
                                setIsGeneratingLipSync(false);
                                setMotionDialogStep("final");
                                toast({
                                  title: "Video Ready!",
                                  description: "Your avatar is now speaking with your voice.",
                                });
                              } else if (statusData.status === "failed") {
                                clearInterval(pollInterval);
                                setLipSyncStatus("failed");
                                setIsGeneratingLipSync(false);
                                toast({
                                  title: "Voice Generation Failed",
                                  description: statusData.error || "Failed to add voice to video.",
                                  variant: "destructive",
                                });
                              } else if (pollCount >= maxPolls) {
                                clearInterval(pollInterval);
                                setLipSyncStatus("failed");
                                setIsGeneratingLipSync(false);
                                toast({
                                  title: "Generation Timeout",
                                  description: "Voice generation is taking too long. Please try again.",
                                  variant: "destructive",
                                });
                              } else {
                                setLipSyncProgress((prev) => Math.min(prev + 5, 90));
                              }
                            } catch (e) {
                              console.error("Polling error:", e);
                              clearInterval(pollInterval);
                              setLipSyncStatus("failed");
                              setIsGeneratingLipSync(false);
                              toast({
                                title: "Connection Error",
                                description: "Lost connection while generating voice.",
                                variant: "destructive",
                              });
                            }
                          }, 3000);
                        } else {
                          setIsGeneratingLipSync(false);
                        }
                      } catch (error: any) {
                        console.error("Lip sync error:", error);
                        console.error("Lip sync error message:", error?.message);
                        console.error("Lip sync error stack:", error?.stack);
                        setLipSyncStatus("failed");
                        setIsGeneratingLipSync(false);
                        const errorMessage = error?.message || (typeof error === 'string' ? error : "Failed to add voice");
                        toast({
                          title: "Voice Generation Failed",
                          description: errorMessage,
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={isGeneratingLipSync || (voiceInputMode === "tts" && !motionVoiceScript.trim()) || (voiceInputMode === "record" && !motionRecordedBlob) || (voiceInputMode === "upload" && !uploadedAudioFile)}
                    data-testid="button-add-voice"
                  >
                    {isGeneratingLipSync ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Voice...
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4 mr-2" />
                        Add Voice & Continue
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3: Final Preview */}
          {motionDialogStep === "final" && (
            <>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Your video is ready!</span>
                </div>
                
                <div className="rounded-lg overflow-hidden border shadow-md bg-black">
                  <video
                    src={finalVideoUrl || motionVideoUrl || ""}
                    controls
                    autoPlay
                    className="w-full max-h-80 object-contain"
                    data-testid="video-final-result"
                  />
                </div>

                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(finalVideoUrl || motionVideoUrl || "", "_blank")}
                    data-testid="button-download-final"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setMotionDialogStep("voice")}
                  data-testid="button-back-to-voice"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => setShowMotionDialog(false)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="button-done"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Look Result Dialog (Demo Mode) */}
      <Dialog open={showEditLookResult} onOpenChange={setShowEditLookResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#D4AF37]" />
              Look Edited Successfully
            </DialogTitle>
            <DialogDescription>
              Your avatar look has been updated with the new style.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-lg overflow-hidden border-2 border-[#D4AF37] shadow-lg">
              <img
                src={demoEditLookResult}
                alt="Edited Look Result"
                className="w-full h-auto object-cover"
                data-testid="img-edit-look-result"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditLookResult(false)}
              data-testid="button-close-edit-result"
            >
              Close
            </Button>
            <Button
              className="btn-golden"
              onClick={() => {
                setShowEditLookResult(false);
                toast({
                  title: "Look Applied",
                  description: "Your edited look is now ready to use.",
                });
              }}
              data-testid="button-use-edited-look"
            >
              <Check className="h-4 w-4 mr-2" />
              Use This Look
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Activity Log Panel - Right Side */}
      {showActivityPanel && (
        <Card className="w-80 flex-shrink-0 h-fit max-h-[600px] sticky top-4" data-testid="activity-log-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Activity Log
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivityLogs([])}
                className="h-6 px-2 text-xs"
                data-testid="button-clear-activity-log"
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              ref={activityLogRef}
              className="space-y-2 overflow-y-auto max-h-[480px] pr-1"
            >
              {activityLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No activity yet</p>
                  <p className="text-xs mt-1">Upload a photo to get started</p>
                </div>
              ) : (
                activityLogs.map((log) => {
                  const style = getStepStyle(log.step);
                  const IconComponent = style.icon;
                  return (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg ${style.bg} border border-gray-100`}
                      data-testid={`activity-log-${log.id}`}
                    >
                      <div className="flex items-start gap-2">
                        {log.previewImage ? (
                          <img 
                            src={log.previewImage} 
                            alt={log.groupName || "Avatar"} 
                            className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-gray-200"
                          />
                        ) : (
                          <div className={`mt-0.5 ${style.color}`}>
                            <IconComponent className={`w-4 h-4 ${log.step === 'training_progress' ? 'animate-spin' : ''}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm text-gray-800 truncate">
                              {log.message}
                            </p>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {log.timestamp}
                            </span>
                          </div>
                          {log.groupName && (
                            <p className="text-xs text-gray-600 truncate">
                              {log.groupName}
                            </p>
                          )}
                          {log.details && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
