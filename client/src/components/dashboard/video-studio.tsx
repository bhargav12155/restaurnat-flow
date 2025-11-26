import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  Download,
  Image,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";

interface StudioAvatar {
  id: string;
  name: string;
  type: "preset" | "photo" | "custom";
  previewUrl?: string;
  thumbnailUrl?: string;
}

interface VideoStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

type Step = 1 | 2 | 3;

export function VideoStudio() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [avatarType, setAvatarType] = useState<"avatar" | "talking_photo">("avatar");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [avatarName, setAvatarName] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: avatarsData, isLoading: avatarsLoading, refetch: refetchAvatars } = useQuery<{ avatars: StudioAvatar[] }>({
    queryKey: ["/api/studio/avatars"],
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", avatarName || "My Avatar");
      
      const res = await fetch("/api/studio/avatars", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Failed to upload");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedAvatar(data.avatar.id);
      setAvatarType("talking_photo");
      setUploadPreview(null);
      setAvatarName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetchAvatars();
      toast({
        title: "Avatar Created!",
        description: "Your custom avatar is ready to use.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Avatar Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (topic: string) => {
      const res = await apiRequest("POST", "/api/studio/script", { topic, type: "marketing" });
      return res.json();
    },
    onSuccess: (data) => {
      setScript(data.script);
      toast({
        title: "Script Generated!",
        description: "Your AI-powered script is ready. Feel free to edit it.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Script Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/studio/generate", {
        avatarId: selectedAvatar,
        avatarType,
        script,
        title: title || topic || "My Video",
        aspectRatio,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setVideoId(data.videoId);
      setIsPolling(true);
      toast({
        title: "Video Generation Started!",
        description: "Your video is being created. This typically takes 3-5 minutes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Video Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: videoStatus } = useQuery<VideoStatus>({
    queryKey: ["/api/studio/status", videoId],
    enabled: !!videoId && isPolling,
    refetchInterval: isPolling ? 5000 : false,
  });

  useEffect(() => {
    if (videoStatus?.status === "completed" || videoStatus?.status === "failed") {
      setIsPolling(false);
      if (videoStatus.status === "completed") {
        toast({
          title: "Video Ready!",
          description: "Your video has been generated successfully.",
        });
      } else if (videoStatus.status === "failed") {
        toast({
          title: "Video Generation Failed",
          description: videoStatus.error || "An error occurred",
          variant: "destructive",
        });
      }
    }
  }, [videoStatus, toast]);

  const handleGenerateScript = () => {
    if (!topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic to generate a script.",
        variant: "destructive",
      });
      return;
    }
    generateScriptMutation.mutate(topic);
  };

  const handleGenerateVideo = () => {
    if (!selectedAvatar) {
      toast({
        title: "Avatar Required",
        description: "Please select an avatar first.",
        variant: "destructive",
      });
      setStep(1);
      return;
    }
    if (!script.trim()) {
      toast({
        title: "Script Required",
        description: "Please enter or generate a script.",
        variant: "destructive",
      });
      return;
    }
    generateVideoMutation.mutate();
  };

  const resetStudio = () => {
    setStep(1);
    setSelectedAvatar("");
    setTopic("");
    setScript("");
    setTitle("");
    setVideoId(null);
    setIsPolling(false);
  };

  const avatars = avatarsData?.avatars || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Studio</h1>
        <p className="text-muted-foreground">Create AI avatar videos in 3 simple steps</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${s}`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 mx-2 ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-6 text-sm text-muted-foreground">
        <span className={step === 1 ? "text-primary font-medium" : ""}>
          <Upload className="inline-block w-4 h-4 mr-1" /> Upload
        </span>
        <span className={step === 2 ? "text-primary font-medium" : ""}>
          <Wand2 className="inline-block w-4 h-4 mr-1" /> Ask
        </span>
        <span className={step === 3 ? "text-primary font-medium" : ""}>
          <Video className="inline-block w-4 h-4 mr-1" /> Get It
        </span>
      </div>

      {step === 1 && (
        <Card data-testid="step-1-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Step 1: Choose Your Avatar
            </CardTitle>
            <CardDescription>
              Upload a photo to create a custom avatar or select from existing ones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Plus className="w-4 h-4 mr-2" /> Upload Photo
                </TabsTrigger>
                <TabsTrigger value="existing" data-testid="tab-existing">
                  <Image className="w-4 h-4 mr-2" /> Existing Avatars
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    id="avatar-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setUploadPreview(url);
                      }
                    }}
                    data-testid="input-avatar-upload"
                  />
                  
                  {uploadPreview ? (
                    <div className="space-y-4">
                      <img 
                        src={uploadPreview} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-full mx-auto border-4 border-primary"
                      />
                      <div className="max-w-xs mx-auto">
                        <Label htmlFor="avatar-name">Avatar Name</Label>
                        <Input
                          id="avatar-name"
                          value={avatarName}
                          onChange={(e) => setAvatarName(e.target.value)}
                          placeholder="Enter a name for your avatar"
                          className="mt-1"
                          data-testid="input-avatar-name"
                        />
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUploadPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          data-testid="button-cancel-upload"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            const file = fileInputRef.current?.files?.[0];
                            if (file) {
                              uploadAvatarMutation.mutate(file);
                            }
                          }}
                          disabled={uploadAvatarMutation.isPending}
                          data-testid="button-create-avatar"
                        >
                          {uploadAvatarMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Create Avatar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="avatar-upload" className="cursor-pointer block">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">Upload a Photo</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        JPG, PNG or WebP (max 10MB). Use a clear, front-facing photo.
                      </p>
                      <Button variant="outline" type="button" data-testid="button-browse-files">
                        Browse Files
                      </Button>
                    </label>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="existing" className="mt-4">
                {avatarsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : avatars.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No avatars available yet.</p>
                    <p className="text-sm mt-2">Upload a photo to create your first avatar!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {avatars.map((avatar) => (
                      <div
                        key={avatar.id}
                        className={`relative border rounded-lg p-3 cursor-pointer transition-all hover:border-primary ${
                          selectedAvatar === avatar.id
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border"
                        }`}
                        onClick={() => {
                          setSelectedAvatar(avatar.id);
                          setAvatarType(avatar.type === "photo" ? "talking_photo" : "avatar");
                        }}
                        data-testid={`avatar-option-${avatar.id}`}
                      >
                        {avatar.thumbnailUrl ? (
                          <img
                            src={avatar.thumbnailUrl}
                            alt={avatar.name}
                            className="w-full aspect-square object-cover rounded-md mb-2"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-sm font-medium truncate">{avatar.name}</p>
                        {selectedAvatar === avatar.id && (
                          <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedAvatar}
                data-testid="step-1-next"
              >
                Next: Create Script
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card data-testid="step-2-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Step 2: Create Your Script
            </CardTitle>
            <CardDescription>
              Tell us what the video is about, or write your own script
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic (for AI script generation)</Label>
              <div className="flex gap-2">
                <Input
                  id="topic"
                  placeholder="e.g., Best neighborhoods for families in Omaha"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  data-testid="input-topic"
                />
                <Button
                  onClick={handleGenerateScript}
                  disabled={generateScriptMutation.isPending || !topic.trim()}
                  variant="secondary"
                  data-testid="button-generate-script"
                >
                  {generateScriptMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span className="ml-2">Generate</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="script">Script</Label>
              <Textarea
                id="script"
                placeholder="Enter your script here or generate one using AI..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={8}
                className="resize-none"
                data-testid="textarea-script"
              />
              <p className="text-xs text-muted-foreground">
                {script.length}/1500 characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Video Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="My Awesome Video"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={(v: any) => setAspectRatio(v)}>
                  <SelectTrigger data-testid="select-aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">Landscape (16:9) - YouTube</SelectItem>
                    <SelectItem value="9:16">Portrait (9:16) - Reels/TikTok</SelectItem>
                    <SelectItem value="1:1">Square (1:1) - Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="step-2-back">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!script.trim()}
                data-testid="step-2-next"
              >
                Next: Generate Video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card data-testid="step-3-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Step 3: Get Your Video
            </CardTitle>
            <CardDescription>
              Review and generate your AI avatar video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Video Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Avatar:</span>{" "}
                  {avatars.find(a => a.id === selectedAvatar)?.name || selectedAvatar}
                </div>
                <div>
                  <span className="text-muted-foreground">Aspect Ratio:</span> {aspectRatio}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Title:</span>{" "}
                  {title || topic || "Untitled"}
                </div>
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground text-sm">Script Preview:</span>
                <p className="text-sm mt-1 line-clamp-3">{script}</p>
              </div>
            </div>

            {videoId && videoStatus && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {videoStatus.status === "processing" && (
                    <>
                      <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                      <span>Processing your video...</span>
                    </>
                  )}
                  {videoStatus.status === "completed" && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>Video ready!</span>
                    </>
                  )}
                  {videoStatus.status === "failed" && (
                    <>
                      <span className="text-red-500">Generation failed: {videoStatus.error}</span>
                    </>
                  )}
                </div>

                {videoStatus.status === "processing" && (
                  <Progress value={videoStatus.progress || 0} className="h-2" />
                )}

                {videoStatus.status === "completed" && videoStatus.videoUrl && (
                  <div className="space-y-4">
                    <video
                      src={videoStatus.videoUrl}
                      controls
                      className="w-full rounded-lg"
                      data-testid="video-player"
                    />
                    <div className="flex gap-2">
                      <Button asChild className="flex-1" data-testid="button-download">
                        <a href={videoStatus.videoUrl} download target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4 mr-2" />
                          Download Video
                        </a>
                      </Button>
                      <Button variant="outline" onClick={resetStudio} data-testid="button-create-new">
                        Create Another
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!videoId && (
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="step-3-back">
                  Back
                </Button>
                <Button
                  onClick={handleGenerateVideo}
                  disabled={generateVideoMutation.isPending}
                  size="lg"
                  data-testid="button-generate-video"
                >
                  {generateVideoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
