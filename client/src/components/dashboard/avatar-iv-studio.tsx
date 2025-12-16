import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Wand2,
  Play,
  Loader2,
  Check,
  Download,
  RefreshCw,
  Image,
  FileText,
  Video,
  ChevronRight,
  ChevronLeft,
  X,
  Volume2,
} from "lucide-react";

interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
}

interface PhotoAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title?: string;
  metadata?: {
    imageKey: string;
    heygenAssetId: string;
  };
  createdAt?: string;
}

const FALLBACK_VOICES = [
  { voice_id: "119caed25533477ba63822d5d1552d25", name: "Default Voice", language: "English", gender: "female" },
];

const MOTION_PROMPTS = [
  { id: "natural", label: "Natural", prompt: "nodding and smiling naturally while speaking, making gentle hand gestures" },
  { id: "professional", label: "Professional", prompt: "professional business presenter with confident posture" },
  { id: "enthusiastic", label: "Enthusiastic", prompt: "enthusiastic and energetic with expressive hand gestures" },
  { id: "calm", label: "Calm", prompt: "calm and thoughtful, speaking slowly" },
  { id: "friendly", label: "Friendly", prompt: "friendly customer service representative" },
];

const STEPS = [
  { id: 1, title: "Upload Photo", icon: Image },
  { id: 2, title: "Write Script", icon: FileText },
  { id: 3, title: "Generate Video", icon: Video },
];

interface VideoStatus {
  video_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

export function AvatarIVStudio() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  
  const [videoTitle, setVideoTitle] = useState("");
  const [script, setScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [selectedMotion, setSelectedMotion] = useState(MOTION_PROMPTS[0].id);
  const [videoOrientation, setVideoOrientation] = useState<"landscape" | "portrait">("landscape");
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch photo library
  const { data: photosData, isLoading: photosLoading, refetch: refetchPhotos } = useQuery<{ photos: PhotoAsset[] }>({
    queryKey: ["/api/avatar-iv/photos"],
  });

  const photoLibrary = photosData?.photos || [];

  // Fetch available voices from HeyGen
  const { data: voicesData, isLoading: voicesLoading } = useQuery<{ voices: Voice[] }>({
    queryKey: ["/api/avatar-iv/voices"],
  });

  const voices = voicesData?.voices || FALLBACK_VOICES;
  
  // Set default voice when voices load
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].voice_id);
    }
  }, [voices, selectedVoice]);

  // Select photo from library
  const selectFromLibrary = (photo: PhotoAsset) => {
    if (photo.metadata?.imageKey) {
      setImageKey(photo.metadata.imageKey);
      setImagePreview(photo.url);
      toast({
        title: "Photo Selected",
        description: "Using photo from your library. Now write your script.",
      });
      setCurrentStep(2);
    } else {
      toast({
        title: "Invalid Photo",
        description: "This photo is missing required data. Please upload a new one.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const playVoicePreview = (previewUrl: string, voiceId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingPreview === voiceId) {
      setPlayingPreview(null);
      return;
    }
    audioRef.current = new Audio(previewUrl);
    audioRef.current.play();
    setPlayingPreview(voiceId);
    audioRef.current.onended = () => setPlayingPreview(null);
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/avatar-iv/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setImageKey(data.imageKey);
      setImagePreview(data.imageUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/avatar-iv/photos"] });
      toast({
        title: "Photo Uploaded!",
        description: "Your photo is ready and saved to your library. Now write your script.",
      });
      setCurrentStep(2);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error?.message || "Could not upload photo",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const motionPrompt = MOTION_PROMPTS.find(m => m.id === selectedMotion)?.prompt;
      
      const response = await apiRequest("POST", "/api/avatar-iv/generate", {
        imageKey,
        videoTitle: videoTitle || "My Video",
        script,
        voiceId: selectedVoice,
        videoOrientation,
        fit: "cover",
        customMotionPrompt: motionPrompt,
        enhanceCustomMotionPrompt: true,
      });

      return response.json();
    },
    onSuccess: (data: any) => {
      console.log("Generate response:", data);
      const videoId = data.videoId;
      if (!videoId) {
        toast({
          title: "Generation Error",
          description: "No video ID returned from server",
          variant: "destructive",
        });
        return;
      }
      setGeneratingVideoId(videoId);
      setVideoStatus({ video_id: videoId, status: "pending" });
      toast({
        title: "Video Generation Started!",
        description: "Your video is being created. This usually takes 1-3 minutes.",
      });
      setCurrentStep(3);
      startPolling(videoId);
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Could not start video generation",
        variant: "destructive",
      });
    },
  });

  const startPolling = (videoId: string) => {
    if (!videoId) {
      console.error("Cannot start polling without a video ID");
      return;
    }
    if (pollInterval) clearInterval(pollInterval);
    
    console.log("Starting status polling for video:", videoId);
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/avatar-iv/status/${videoId}`, {
          credentials: "include",
        });
        
        if (!response.ok) return;
        
        const status: VideoStatus = await response.json();
        setVideoStatus(status);
        
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(interval);
          setPollInterval(null);
          
          if (status.status === "completed") {
            toast({
              title: "Video Ready!",
              description: "Your video has been generated successfully.",
            });
          } else {
            toast({
              title: "Generation Failed",
              description: status.error || "Video generation failed",
              variant: "destructive",
            });
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 5000);
    
    setPollInterval(interval);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("File selected:", file?.name, file?.type, file?.size);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG)",
        variant: "destructive",
      });
      return;
    }

    setUploadedImage(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      console.log("FileReader result length:", result?.length);
      setImagePreview(result);
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (uploadedImage) {
      uploadMutation.mutate(uploadedImage);
    }
  };

  const resetStudio = () => {
    setCurrentStep(1);
    setUploadedImage(null);
    setImagePreview(null);
    setImageKey(null);
    setVideoTitle("");
    setScript("");
    setGeneratingVideoId(null);
    setVideoStatus(null);
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  const canProceedToStep2 = !!imageKey;
  const canProceedToStep3 = canProceedToStep2 && script.trim().length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#D4AF37]" />
            Quick Video Creator
          </CardTitle>
          <CardDescription>
            Create AI-powered talking videos in 3 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isClickable = step.id < currentStep || 
                (step.id === 2 && canProceedToStep2) || 
                (step.id === 3 && canProceedToStep3);

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
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Select Your Photo</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Choose from your library or upload a new photo
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-4">
                <Button
                  variant={showLibrary ? "default" : "outline"}
                  onClick={() => setShowLibrary(true)}
                  className={showLibrary ? "bg-[#D4AF37] hover:bg-[#D4AF37]/90" : ""}
                  data-testid="tab-library"
                >
                  <Image className="h-4 w-4 mr-2" />
                  My Library ({photoLibrary.length})
                </Button>
                <Button
                  variant={!showLibrary ? "default" : "outline"}
                  onClick={() => setShowLibrary(false)}
                  className={!showLibrary ? "bg-[#D4AF37] hover:bg-[#D4AF37]/90" : ""}
                  data-testid="tab-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New
                </Button>
              </div>

              {showLibrary ? (
                <div className="space-y-4">
                  {photosLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
                    </div>
                  ) : photoLibrary.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                      <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">No photos in your library yet</p>
                      <Button
                        variant="outline"
                        onClick={() => setShowLibrary(false)}
                        data-testid="button-upload-first"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Your First Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {photoLibrary.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => selectFromLibrary(photo)}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:border-[#D4AF37] hover:shadow-lg ${
                            imageKey === photo.metadata?.imageKey
                              ? "border-[#D4AF37] ring-2 ring-[#D4AF37]"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                          data-testid={`photo-library-${photo.id}`}
                        >
                          <img
                            src={photo.thumbnailUrl || photo.url}
                            alt={photo.title || "Photo"}
                            className="w-full aspect-square object-cover"
                          />
                          {imageKey === photo.metadata?.imageKey && (
                            <div className="absolute inset-0 bg-[#D4AF37]/20 flex items-center justify-center">
                              <Check className="h-8 w-8 text-[#D4AF37]" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {!imagePreview ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all"
                      data-testid="upload-dropzone"
                    >
                      <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400">PNG, JPG up to 10MB</p>
                    </div>
                  ) : (
                    <div className="relative max-w-md mx-auto">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full rounded-xl shadow-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setUploadedImage(null);
                          setImagePreview(null);
                          setImageKey(null);
                        }}
                        data-testid="button-remove-image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {uploadedImage && !imageKey && (
                    <div className="flex justify-center">
                      <Button
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                        className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white px-8"
                        data-testid="button-upload"
                      >
                        {uploadMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Photo
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file"
              />

              {imageKey && (
                <div className="flex justify-center">
                  <Button
                    onClick={() => setCurrentStep(2)}
                    className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white px-8"
                    data-testid="button-next-step-1"
                  >
                    Continue to Script
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6" data-testid="step-2-content">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Write Your Script</h3>
                <p className="text-gray-500 text-sm">
                  Enter what you want your avatar to say and customize the voice
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="videoTitle">Video Title</Label>
                    <Input
                      id="videoTitle"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="My Marketing Video"
                      className="mt-1"
                      data-testid="input-video-title"
                    />
                  </div>

                  <div>
                    <Label htmlFor="script">Script (max 1500 characters)</Label>
                    <Textarea
                      id="script"
                      value={script}
                      onChange={(e) => setScript(e.target.value.slice(0, 1500))}
                      placeholder="Hello! Welcome to my video. I'm excited to share..."
                      className="mt-1 min-h-[150px]"
                      data-testid="input-script"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {script.length}/1500 characters
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      Voice
                      {voicesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      <Badge variant="secondary" className="text-xs">
                        {voices.length} available
                      </Badge>
                    </Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="mt-1" data-testid="select-voice">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-[300px]">
                          {voices.map((voice) => (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{voice.name}</span>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {voice.language}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {voice.gender}
                                  </Badge>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    {selectedVoice && voices.find(v => v.voice_id === selectedVoice)?.preview_audio && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          const voice = voices.find(v => v.voice_id === selectedVoice);
                          if (voice?.preview_audio) {
                            playVoicePreview(voice.preview_audio, voice.voice_id);
                          }
                        }}
                        data-testid="button-preview-voice"
                      >
                        <Volume2 className="h-4 w-4 mr-1" />
                        {playingPreview === selectedVoice ? "Playing..." : "Preview Voice"}
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label>Motion Style</Label>
                    <Select value={selectedMotion} onValueChange={setSelectedMotion}>
                      <SelectTrigger className="mt-1" data-testid="select-motion">
                        <SelectValue placeholder="Select motion style" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTION_PROMPTS.map((motion) => (
                          <SelectItem key={motion.id} value={motion.id}>
                            {motion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Video Orientation</Label>
                    <Select 
                      value={videoOrientation} 
                      onValueChange={(v) => setVideoOrientation(v as "landscape" | "portrait")}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-orientation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">Landscape (16:9)</SelectItem>
                        <SelectItem value="portrait">Portrait (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {imagePreview && (
                    <div>
                      <Label>Your Photo</Label>
                      <img
                        src={imagePreview}
                        alt="Selected"
                        className="mt-1 w-24 h-24 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  data-testid="button-back-step-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!script.trim() || generateMutation.isPending}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white px-8"
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6" data-testid="step-3-content">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Your Video</h3>
                <p className="text-gray-500 text-sm">
                  {videoStatus?.status === "completed" 
                    ? "Your video is ready!" 
                    : "Video generation in progress..."}
                </p>
              </div>

              <div className="max-w-2xl mx-auto">
                {videoStatus?.status === "completed" && videoStatus.video_url ? (
                  <div className="space-y-4">
                    <video
                      src={videoStatus.video_url}
                      controls
                      className="w-full rounded-xl shadow-lg"
                      data-testid="video-player"
                    />
                    <div className="flex justify-center gap-4">
                      <Button
                        variant="outline"
                        asChild
                        data-testid="button-download"
                      >
                        <a href={videoStatus.video_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                      <Button
                        onClick={resetStudio}
                        className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                        data-testid="button-create-new"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Create New Video
                      </Button>
                    </div>
                  </div>
                ) : videoStatus?.status === "failed" ? (
                  <div className="text-center py-12 border rounded-xl">
                    <X className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-red-500 font-medium mb-2">Generation Failed</p>
                    <p className="text-gray-500 text-sm mb-4">{videoStatus.error || "Something went wrong"}</p>
                    <Button
                      onClick={() => setCurrentStep(2)}
                      variant="outline"
                      data-testid="button-try-again"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-xl">
                    <Loader2 className="h-12 w-12 mx-auto text-[#D4AF37] mb-4 animate-spin" />
                    <p className="font-medium mb-2">Generating Your Video...</p>
                    <p className="text-gray-500 text-sm mb-4">
                      This usually takes 1-3 minutes
                    </p>
                    <Badge variant="secondary" className="text-sm">
                      Status: {videoStatus?.status || "pending"}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
