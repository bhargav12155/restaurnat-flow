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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface VideoAvatar {
  id: number;
  heygenAvatarId: string;
  avatarName: string;
  status: string;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  voiceId?: string;
  createdAt?: string;
}

export function VideoAvatarManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Navigate to video generation page
  const goToVideoGeneration = () => {
    // Use window.location.hash for hash-based navigation within dashboard
    window.location.hash = "video-generation";
    // Dispatch event to notify dashboard of hash change
    window.dispatchEvent(new Event('hashchange'));
  };
  
  // Form state for creating new avatar
  const [avatarName, setAvatarName] = useState("");
  const [trainingVideoUrl, setTrainingVideoUrl] = useState("");
  const [consentVideoUrl, setConsentVideoUrl] = useState("");
  const [uploadingTraining, setUploadingTraining] = useState(false);
  const [uploadingConsent, setUploadingConsent] = useState(false);
  
  // Status check state
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Fetch all video avatars
  const { data: avatars = [], isLoading } = useQuery<VideoAvatar[]>({
    queryKey: ["/api/video-avatars"],
    refetchInterval: (query) => {
      const avatarList = query.state.data ?? [];
      const hasInProgress = avatarList.some(
        (a: VideoAvatar) => a.status === "pending" || a.status === "processing" || a.status === "in_progress"
      );
      return hasInProgress ? 10000 : false;
    },
  });

  // Filter avatars by status
  const readyAvatars = avatars.filter(
    (a) => a.status === "complete" || a.status === "completed" || a.status === "ready"
  );
  const pendingAvatars = avatars.filter(
    (a) => a.status === "pending" || a.status === "processing" || a.status === "in_progress"
  );

  // Create avatar mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      trainingVideoUrl: string;
      consentVideoUrl: string;
    }) => {
      const res = await fetch("/api/video-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Failed to create avatar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Avatar Creation Started",
        description: "This may take several hours. We'll notify you when complete.",
      });
      setAvatarName("");
      setTrainingVideoUrl("");
      setConsentVideoUrl("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message,
      });
    },
  });

  // Delete avatar mutation
  const deleteMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await fetch(`/api/video-avatars/${avatarId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete avatar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Avatar Deleted",
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

  // Check status mutation
  const checkStatusMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      setCheckingStatusId(avatarId);
      const res = await fetch(`/api/video-avatars/${avatarId}/status`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Failed to check status");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      
      const messages: Record<string, { title: string; description: string; variant?: "default" | "destructive" }> = {
        complete: {
          title: "Avatar Ready! ✅",
          description: `Your avatar is complete and ready to create videos.`,
        },
        in_progress: {
          title: "Still Processing",
          description: `Avatar is ${data.progress ? `${data.progress}% complete` : "still being created"}.`,
        },
        failed: {
          title: "Avatar Creation Failed",
          description: data.errorMessage || "There was an error. Please try again.",
          variant: "destructive",
        },
      };

      const msg = messages[data.status] || { title: "Status Unknown", description: "Could not determine status." };
      toast({
        title: msg.title,
        description: msg.description,
        variant: msg.variant,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Status Check Failed",
        description: error.message,
      });
    },
    onSettled: () => {
      setCheckingStatusId(null);
    },
  });

  // Sync from HeyGen mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/video-avatars/sync", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Failed to sync avatars");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Sync Complete! 🔄",
        description: `Imported ${data.imported} new avatars. ${data.skipped} already existed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message,
      });
    },
  });

  // File upload handler
  const handleFileUpload = async (file: File, type: "training" | "consent") => {
    const setUploading = type === "training" ? setUploadingTraining : setUploadingConsent;
    const setUrl = type === "training" ? setTrainingVideoUrl : setConsentVideoUrl;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type === "training" ? "avatar-training" : "avatar-consent");

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      
      const { url } = await res.json();
      setUrl(url);
      
      toast({
        title: "Upload Complete",
        description: `${type === "training" ? "Training" : "Consent"} video uploaded successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload video",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    if (!avatarName.trim()) {
      toast({ variant: "destructive", title: "Name Required", description: "Please enter a name for your avatar." });
      return;
    }
    if (!trainingVideoUrl) {
      toast({ variant: "destructive", title: "Training Video Required", description: "Please upload a training video." });
      return;
    }
    if (!consentVideoUrl) {
      toast({ variant: "destructive", title: "Consent Video Required", description: "Please upload a consent video." });
      return;
    }

    createMutation.mutate({
      name: avatarName,
      trainingVideoUrl,
      consentVideoUrl,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
      case "completed":
      case "ready":
        return <Badge className="bg-green-500 text-white"><Check className="w-3 h-3 mr-1" />Ready</Badge>;
      case "pending":
      case "processing":
      case "in_progress":
        return <Badge className="bg-yellow-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Video Avatars</h2>
          <p className="text-muted-foreground">
            Train AI avatars from your videos, then create unlimited video content
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync from HeyGen
          </Button>
          {readyAvatars.length > 0 && (
            <Button
              onClick={goToVideoGeneration}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Create Video
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="avatars" className="w-full">
        <TabsList>
          <TabsTrigger value="avatars">My Avatars ({avatars.length})</TabsTrigger>
          <TabsTrigger value="create">Create New Avatar</TabsTrigger>
        </TabsList>

        {/* Avatars Tab */}
        <TabsContent value="avatars" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : avatars.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Video className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Video Avatars Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first AI avatar or sync existing ones from HeyGen.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => syncMutation.mutate()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync from HeyGen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Ready Avatars */}
              {readyAvatars.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Ready to Use ({readyAvatars.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {readyAvatars.map((avatar) => (
                      <Card key={avatar.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                          {avatar.thumbnailUrl || avatar.previewVideoUrl ? (
                            avatar.previewVideoUrl ? (
                              <video
                                src={avatar.previewVideoUrl}
                                className="w-full h-full object-cover"
                                muted
                                loop
                                onMouseEnter={(e) => e.currentTarget.play()}
                                onMouseLeave={(e) => {
                                  e.currentTarget.pause();
                                  e.currentTarget.currentTime = 0;
                                }}
                              />
                            ) : (
                              <img
                                src={avatar.thumbnailUrl}
                                alt={avatar.avatarName}
                                className="w-full h-full object-cover"
                              />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2">
                            {getStatusBadge(avatar.status)}
                          </div>
                          {avatar.voiceId && (
                            <div className="absolute bottom-2 left-2">
                              <Badge variant="secondary" className="text-xs">
                                🎤 Built-in Voice
                              </Badge>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h4 className="font-semibold truncate">{avatar.avatarName}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            ID: {avatar.heygenAvatarId}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="flex-1 bg-purple-600 hover:bg-purple-700"
                              onClick={goToVideoGeneration}
                            >
                              <Wand2 className="w-4 h-4 mr-1" />
                              Create Video
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteMutation.mutate(avatar.heygenAvatarId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Avatars */}
              {pendingAvatars.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                    Processing ({pendingAvatars.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingAvatars.map((avatar) => (
                      <Card key={avatar.id} className="overflow-hidden opacity-75">
                        <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                          <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
                          </div>
                          <div className="absolute top-2 right-2">
                            {getStatusBadge(avatar.status)}
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <h4 className="font-semibold truncate">{avatar.avatarName}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Training in progress...
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-3"
                            onClick={() => checkStatusMutation.mutate(avatar.heygenAvatarId)}
                            disabled={checkingStatusId === avatar.heygenAvatarId}
                          >
                            {checkingStatusId === avatar.heygenAvatarId ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Check Status
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Create Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Video Avatar</CardTitle>
              <CardDescription>
                Upload a training video of yourself to create an AI avatar that can speak any script
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label>Avatar Name</Label>
                <Input
                  placeholder="e.g., My Professional Avatar"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                />
              </div>

              {/* Training Video */}
              <div className="space-y-2">
                <Label>Training Video</Label>
                <p className="text-sm text-muted-foreground">
                  Upload a 2-5 minute video of yourself speaking naturally, looking at the camera.
                </p>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {trainingVideoUrl ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                      <p className="text-sm text-green-600">Training video uploaded</p>
                      <video src={trainingVideoUrl} controls className="max-w-full max-h-48 mx-auto rounded" />
                      <Button variant="outline" size="sm" onClick={() => setTrainingVideoUrl("")}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "training")}
                        disabled={uploadingTraining}
                      />
                      {uploadingTraining ? (
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium">Click to upload training video</p>
                          <p className="text-xs text-muted-foreground">MP4, MOV, or WebM • 2-5 minutes</p>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Consent Video */}
              <div className="space-y-2">
                <Label>Consent Video</Label>
                <p className="text-sm text-muted-foreground">
                  Record a short video saying: "I authorize HeyGen to create an AI avatar of me."
                </p>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {consentVideoUrl ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                      <p className="text-sm text-green-600">Consent video uploaded</p>
                      <video src={consentVideoUrl} controls className="max-w-full max-h-48 mx-auto rounded" />
                      <Button variant="outline" size="sm" onClick={() => setConsentVideoUrl("")}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "consent")}
                        disabled={uploadingConsent}
                      />
                      {uploadingConsent ? (
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium">Click to upload consent video</p>
                          <p className="text-xs text-muted-foreground">Short video with consent statement</p>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !avatarName || !trainingVideoUrl || !consentVideoUrl}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Video className="w-4 h-4 mr-2" />
                )}
                Create Video Avatar
              </Button>

              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Avatar creation typically takes 2-4 hours. You'll be able to create unlimited videos once your avatar is ready.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VideoAvatarManager;
