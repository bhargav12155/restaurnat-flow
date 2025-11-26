import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Smartphone,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

interface VideoAvatar {
  id: string;
  avatarName: string;
  heygenAvatarId: string;
  trainingVideoUrl: string;
  consentVideoUrl: string;
  voiceId: string | null;
  status: "in_progress" | "complete" | "failed";
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export default function VideoAvatarManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [avatarName, setAvatarName] = useState("");
  const [trainingVideoUrl, setTrainingVideoUrl] = useState("");
  const [consentVideoUrl, setConsentVideoUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [uploadingTraining, setUploadingTraining] = useState(false);
  const [uploadingConsent, setUploadingConsent] = useState(false);
  const [showConsentScript, setShowConsentScript] = useState(false);

  // QR code state for mobile uploads
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrUploadType, setQrUploadType] = useState<"training" | "consent">("training");
  const [qrPolling, setQrPolling] = useState(false);

  // Fetch video avatars
  const { data: avatars = [], isLoading: isLoadingAvatars } = useQuery<
    VideoAvatar[]
  >({
    queryKey: ["/api/video-avatars"],
    refetchInterval: (query) => {
      // Auto-refresh if any avatar is in progress
      const data = query.state.data;
      const hasInProgress = data?.some(
        (a: VideoAvatar) => a.status === "in_progress"
      );
      return hasInProgress ? 10000 : false; // Poll every 10s if in progress
    },
  });

  // Create video avatar mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      trainingVideoUrl: string;
      consentVideoUrl: string;
      voiceId?: string;
    }) => {
      const res = await fetch("/api/video-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          error.details || error.error || "Failed to create video avatar"
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Video Avatar Creation Started",
        description:
          "This may take several hours. We'll notify you when complete.",
      });
      // Reset form
      setAvatarName("");
      setTrainingVideoUrl("");
      setConsentVideoUrl("");
      setVoiceId("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message,
      });
    },
  });

  // Delete video avatar mutation
  const deleteMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await fetch(`/api/video-avatars/${avatarId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete video avatar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Video Avatar Deleted",
        description: "The video avatar has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    },
  });

  // Helper function to check video duration
  const checkVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        reject(new Error("Could not load video metadata"));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // Handle file upload to S3 (you'll need to implement this endpoint)
  const handleFileUpload = async (file: File, type: "training" | "consent") => {
    const setUploading =
      type === "training" ? setUploadingTraining : setUploadingConsent;
    const setUrl =
      type === "training" ? setTrainingVideoUrl : setConsentVideoUrl;

    try {
      setUploading(true);

      // Validate file type
      if (!file.type.startsWith("video/")) {
        throw new Error("Please upload a video file");
      }

      // Check video duration for training footage (max 2 minutes)
      if (type === "training") {
        try {
          const duration = await checkVideoDuration(file);
          const maxDuration = 120; // 2 minutes in seconds
          
          if (duration > maxDuration) {
            toast({
              variant: "destructive",
              title: "Video Too Long",
              description: `Training footage must be under 2 minutes. Your video is ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')} long.`,
            });
            setUploading(false);
            return;
          }
          
          if (duration < 30) {
            toast({
              variant: "destructive", 
              title: "Video Too Short",
              description: "Training footage should be at least 30 seconds to capture enough movements and voice.",
            });
            setUploading(false);
            return;
          }
        } catch (durationError) {
          console.warn("Could not check video duration:", durationError);
          // Continue with upload anyway if duration check fails
        }
      }

      const formData = new FormData();
      formData.append("video", file);
      formData.append("type", type);

      const res = await fetch("/api/upload/video-avatar-footage", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || "Upload failed");
      }

      const { url } = await res.json();
      setUrl(url);

      toast({
        title: "Upload Successful",
        description: `${
          type === "training" ? "Training" : "Consent"
        } video uploaded`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  // Create mobile upload session for QR code functionality
  const createMobileSession = async (type: "training" | "consent") => {
    const res = await fetch("/api/mobile-upload/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error("Failed to create session");
    const data = await res.json();
    return data.sessionId;
  };

  // Handle "Upload from Phone" button click
  const handlePhoneUpload = async (type: "training" | "consent") => {
    setQrUploadType(type);
    try {
      const sessionId = await createMobileSession(type);
      setQrSessionId(sessionId);
      setQrDialogOpen(true);
      setQrPolling(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
      });
    }
  };

  // Polling effect for mobile upload completion
  useEffect(() => {
    if (!qrPolling || !qrSessionId) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mobile-upload/${qrSessionId}/status`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.complete && data.url) {
          if (qrUploadType === "training") {
            setTrainingVideoUrl(data.url);
          } else {
            setConsentVideoUrl(data.url);
          }
          setQrPolling(false);
          setQrDialogOpen(false);
          toast({
            title: "Upload Complete!",
            description: `${qrUploadType === "training" ? "Training" : "Consent"} video uploaded from your phone.`,
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [qrPolling, qrSessionId, qrUploadType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!avatarName || !trainingVideoUrl || !consentVideoUrl) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide avatar name and upload both videos",
      });
      return;
    }

    createMutation.mutate({
      name: avatarName,
      trainingVideoUrl,
      consentVideoUrl,
      voiceId: voiceId || undefined,
    });
  };

  const getStatusBadge = (status: VideoAvatar["status"]) => {
    switch (status) {
      case "in_progress":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress
          </Badge>
        );
      case "complete":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
    }
  };

  const inProgressAvatars = avatars.filter((a) => a.status === "in_progress");
  const completeAvatars = avatars.filter((a) => a.status === "complete");
  const failedAvatars = avatars.filter((a) => a.status === "failed");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold">Video Avatar Manager</h1>
        <Badge
          variant="secondary"
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1"
        >
          ENTERPRISE ONLY
        </Badge>
      </div>
      <p className="text-muted-foreground mb-4">
        Create high-fidelity video avatars from training footage
      </p>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Requirements:</strong> Training footage must be under 2 minutes
          (30 seconds to 2 minutes is ideal for capturing movements and voice),
          720p or higher, MP4 format. You must also provide a consent video with
          the required statement.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create">Create New Avatar</TabsTrigger>
          <TabsTrigger value="library">
            My Video Avatars ({completeAvatars.length})
          </TabsTrigger>
          {inProgressAvatars.length > 0 && (
            <TabsTrigger value="progress">
              In Progress ({inProgressAvatars.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create Video Avatar</CardTitle>
              <CardDescription>
                Upload training footage and consent video to create a custom
                video avatar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="avatarName">Avatar Name *</Label>
                  <Input
                    id="avatarName"
                    value={avatarName}
                    onChange={(e) => setAvatarName(e.target.value)}
                    placeholder="e.g., Professional Sarah"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trainingVideo">Training Footage *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="trainingVideo"
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "training");
                      }}
                      disabled={uploadingTraining}
                    />
                    {uploadingTraining && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  {trainingVideoUrl && (
                    <p className="text-sm text-green-600">
                      ✓ Training video uploaded
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Under 2 minutes (ideal for capturing movements and voice), 720p or higher, clear speaking footage
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePhoneUpload("training")}
                    data-testid="button-phone-upload-training"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Upload from Phone
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="consentVideo">Consent Video *</Label>
                    <Button
                      type="button"
                      onClick={() => setShowConsentScript(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all"
                      data-testid="button-read-consent-script"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Read Script
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="consentVideo"
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "consent");
                      }}
                      disabled={uploadingConsent}
                    />
                    {uploadingConsent && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  {consentVideoUrl && (
                    <p className="text-sm text-green-600">
                      ✓ Consent video uploaded
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Record yourself reading the HeyGen consent statement
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePhoneUpload("consent")}
                    data-testid="button-phone-upload-consent"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Upload from Phone
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voiceId">Voice ID (Optional)</Label>
                  <Input
                    id="voiceId"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    placeholder="Leave empty to use default"
                  />
                  <p className="text-sm text-muted-foreground">
                    Specify a HeyGen voice ID for this avatar
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !trainingVideoUrl ||
                    !consentVideoUrl
                  }
                  className="w-full"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Avatar...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Create Video Avatar
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingAvatars ? (
              <div className="col-span-full text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Loading video avatars...
                </p>
              </div>
            ) : completeAvatars.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No video avatars yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first video avatar from training footage
                </p>
              </div>
            ) : (
              completeAvatars.map((avatar) => (
                <Card key={avatar.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {avatar.avatarName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(avatar.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(avatar.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Avatar ID:
                        </span>
                        <p className="font-mono text-xs truncate">
                          {avatar.heygenAvatarId}
                        </p>
                      </div>
                      {avatar.voiceId && (
                        <div>
                          <span className="text-muted-foreground">
                            Voice ID:
                          </span>
                          <p className="font-mono text-xs truncate">
                            {avatar.voiceId}
                          </p>
                        </div>
                      )}
                      {avatar.completedAt && (
                        <div>
                          <span className="text-muted-foreground">
                            Completed:
                          </span>
                          <p className="text-xs">
                            {new Date(avatar.completedAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() =>
                        deleteMutation.mutate(avatar.heygenAvatarId)
                      }
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete Avatar
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {inProgressAvatars.length > 0 && (
          <TabsContent value="progress">
            <div className="space-y-4">
              {inProgressAvatars.map((avatar) => (
                <Card key={avatar.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{avatar.avatarName}</CardTitle>
                        <CardDescription>
                          Started {new Date(avatar.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(avatar.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          Creating avatar...
                        </span>
                        <span className="text-muted-foreground">
                          This may take several hours
                        </span>
                      </div>
                      <Progress value={undefined} className="h-2" />
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Video avatar creation is processing. You can close this
                        page and come back later. The page will auto-refresh
                        every 10 seconds.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {failedAvatars.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Failed Avatars</CardTitle>
            <CardDescription>
              These avatar creations encountered errors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {failedAvatars.map((avatar) => (
              <div
                key={avatar.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{avatar.avatarName}</p>
                    {getStatusBadge(avatar.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {new Date(avatar.createdAt).toLocaleDateString()}
                  </p>
                  {avatar.errorMessage && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-sm">
                        {avatar.errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(avatar.heygenAvatarId)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConsentScript} onOpenChange={setShowConsentScript}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              HeyGen Consent Statement
            </DialogTitle>
            <DialogDescription>
              Record yourself reading this statement clearly while looking at the camera
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-6 rounded-lg border-2 border-dashed">
              <p className="text-lg leading-relaxed font-medium text-center">
                "I, <span className="text-primary underline">[state your full name]</span>, am aware that my voice and likeness will be used to create an AI-generated avatar. I authorize HeyGen to use this recording to train and generate synthetic videos featuring my digital likeness and voice."
              </p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Recording Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Look directly at the camera while speaking</li>
                <li>Speak clearly and at a natural pace</li>
                <li>Ensure good lighting on your face</li>
                <li>Record in a quiet environment</li>
                <li>Say your actual full legal name where indicated</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowConsentScript(false)}>
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrDialogOpen} onOpenChange={(open) => {
        setQrDialogOpen(open);
        if (!open) setQrPolling(false);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Upload from Phone
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your phone to upload your {qrUploadType} video
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrSessionId && (
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/mobile-upload/${qrSessionId}`}
                  size={200}
                  level="H"
                />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for upload...
            </div>
            <p className="text-xs text-center text-muted-foreground max-w-xs">
              The QR code expires in 15 minutes. This dialog will close automatically when upload completes.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
