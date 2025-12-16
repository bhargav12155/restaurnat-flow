import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";

const PROFESSIONAL_VOICES = [
  { id: "119caed25533477ba63822d5d1552d25", name: "Neutral - Balanced" },
  { id: "92c93dc0dff2428ab0bea258ba68f173", name: "Professional Male - Confident" },
  { id: "f577da968446491289b53bceb77e5092", name: "Professional Male - Warm" },
  { id: "73c0b6a2e29d4d38aca41454bf58c955", name: "Professional Female - Clear" },
  { id: "1c7c897eeb2d4b5fb17d3c6c70250b24", name: "Professional Female - Friendly" },
  { id: "9f2e8c4a7b5d4f6e8a1c3d5b7e9f2a4c", name: "Energetic - Enthusiastic" },
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
  
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  
  const [videoTitle, setVideoTitle] = useState("");
  const [script, setScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(PROFESSIONAL_VOICES[0].id);
  const [selectedMotion, setSelectedMotion] = useState(MOTION_PROMPTS[0].id);
  const [videoOrientation, setVideoOrientation] = useState<"landscape" | "portrait">("landscape");
  
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

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
      toast({
        title: "Photo Uploaded!",
        description: "Your photo is ready. Now write your script.",
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

      return response;
    },
    onSuccess: (data: any) => {
      setGeneratingVideoId(data.videoId);
      setVideoStatus({ video_id: data.videoId, status: "pending" });
      toast({
        title: "Video Generation Started!",
        description: "Your video is being created. This usually takes 1-3 minutes.",
      });
      setCurrentStep(3);
      startPolling(data.videoId);
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
    if (pollInterval) clearInterval(pollInterval);
    
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
    reader.onload = (e) => setImagePreview(e.target?.result as string);
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
                <h3 className="text-lg font-semibold mb-2">Upload Your Photo</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Upload a clear photo of yourself or any person you want to animate
                </p>
              </div>

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

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file"
              />

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
                    <Label>Voice</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="mt-1" data-testid="select-voice">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONAL_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
