import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PropertySelector, Property } from "./property-selector";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Home,
  Image,
  Settings,
  Video,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Wand2,
  Loader2,
  Check,
  Play,
  User,
  Building,
  Trees,
  Palette,
  Download,
  Library,
  Share2,
} from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin, SiX, SiYoutube, SiTiktok } from "react-icons/si";

interface AvatarPhoto {
  id: string;
  image_url: string;
  avatar_name: string;
  image_key?: string;
}

interface SelectedPhoto {
  url: string;
  index: number;
  selected: boolean;
}

const STEPS = [
  { id: 1, title: "Select Property", icon: Home, description: "Choose a listing" },
  { id: 2, title: "Arrange Photos", icon: Image, description: "Select and order photos" },
  { id: 3, title: "Tour Settings", icon: Settings, description: "Avatar, background, script" },
  { id: 4, title: "Generate Video", icon: Video, description: "Create your tour" },
];

const BACKGROUND_OPTIONS = [
  { value: "office", label: "Office", icon: Building },
  { value: "outdoor", label: "Outdoor", icon: Trees },
  { value: "branded", label: "Branded", icon: Palette },
];

export function PropertyTourStudio() {
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [backgroundType, setBackgroundType] = useState<string>("office");
  const [includeBranding, setIncludeBranding] = useState<boolean>(true);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationComplete, setGenerationComplete] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const { data: avatarsData, isLoading: avatarsLoading } = useQuery<{ photos: AvatarPhoto[] }>({
    queryKey: ["/api/avatar-iv/photos"],
    enabled: currentStep >= 3,
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (property: Property) => {
      const propertyDetails = `
Property Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
List Price: $${property.listPrice.toLocaleString()}
${property.bedrooms ? `Bedrooms: ${property.bedrooms}` : ""}
${property.bathrooms ? `Bathrooms: ${property.bathrooms}` : ""}
${property.squareFootage ? `Square Footage: ${property.squareFootage.toLocaleString()} sq ft` : ""}
Property Type: ${property.propertyType}
${property.neighborhood ? `Neighborhood: ${property.neighborhood}` : ""}
${property.description ? `Description: ${property.description}` : ""}
${property.features && property.features.length > 0 ? `Features: ${property.features.join(", ")}` : ""}
`.trim();

      const response = await apiRequest("POST", "/api/ai/chat", {
        messages: [
          {
            role: "system",
            content: "You are a professional real estate video script writer. Create engaging property tour narration scripts. IMPORTANT: Only describe features that are explicitly mentioned in the property data provided. Do not make up or assume any features, amenities, or characteristics that are not in the MLS data. Keep the script concise (under 200 words), professional, and suitable for video narration."
          },
          {
            role: "user",
            content: `Write a property tour video script for this listing. Only include information that is explicitly provided below. Do not fabricate any details:\n\n${propertyDetails}`
          }
        ]
      });
      return response.json();
    },
    onSuccess: (data) => {
      const script = data.choices?.[0]?.message?.content || data.content || "";
      setGeneratedScript(script);
      toast({
        title: "Script Generated",
        description: "Your property tour script is ready. Feel free to edit it.",
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

  const handlePropertySelect = useCallback((property: Property) => {
    setSelectedProperty(property);
    const photos = property.photoUrls?.map((url, index) => ({
      url,
      index,
      selected: true,
    })) || [];
    setSelectedPhotos(photos);
    setGeneratedScript("");
    setCurrentStep(2);
  }, []);

  const handlePhotoToggle = useCallback((index: number) => {
    setSelectedPhotos(prev => 
      prev.map((photo, i) => 
        i === index ? { ...photo, selected: !photo.selected } : photo
      )
    );
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setSelectedPhotos(prev => {
      const newPhotos = [...prev];
      const [draggedPhoto] = newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(index, 0, draggedPhoto);
      return newPhotos.map((photo, i) => ({ ...photo, index: i }));
    });
    setDraggedIndex(index);
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleGenerateScript = useCallback(() => {
    if (!selectedProperty) return;
    generateScriptMutation.mutate(selectedProperty);
  }, [selectedProperty, generateScriptMutation]);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [motionVideos, setMotionVideos] = useState<string[]>([]);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);
  const [savedVideos, setSavedVideos] = useState<{ url: string; id: string; title: string }[]>([]);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [selectedVideoForShare, setSelectedVideoForShare] = useState<string>("");
  const [shareContent, setShareContent] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isSavingToLibrary, setIsSavingToLibrary] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);

  const SOCIAL_PLATFORMS = [
    { value: "facebook", label: "Facebook", icon: SiFacebook },
    { value: "instagram", label: "Instagram", icon: SiInstagram },
    { value: "linkedin", label: "LinkedIn", icon: SiLinkedin },
    { value: "x", label: "X (Twitter)", icon: SiX },
    { value: "youtube", label: "YouTube", icon: SiYoutube },
    { value: "tiktok", label: "TikTok", icon: SiTiktok },
  ];

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/property-tour/status/${jobId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to check status");
      }
      
      const data = await response.json();
      setGenerationProgress(data.progress || 0);
      setStatusMessage(data.message || "Processing...");
      
      if (data.motionVideos && data.motionVideos.length > 0) {
        setMotionVideos(data.motionVideos);
      }
      
      if (data.status === "completed") {
        setGenerationComplete(true);
        setIsGenerating(false);
        if (data.finalVideoUrl) {
          setGeneratedVideoUrl(data.finalVideoUrl);
        }
        if (data.motionVideos) {
          setMotionVideos(data.motionVideos);
        }
        if (data.avatarVideoUrl) {
          setAvatarVideoUrl(data.avatarVideoUrl);
        }
        const avatarMsg = data.avatarVideoUrl ? " and avatar narration" : "";
        toast({
          title: "Video Generation Complete",
          description: `Generated ${data.motionVideos?.length || 1} motion clips${avatarMsg}!`,
        });
        return true;
      }
      
      if (data.status === "failed") {
        setIsGenerating(false);
        toast({
          title: "Generation Failed",
          description: data.error || "Video generation failed",
          variant: "destructive",
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error polling status:", error);
      return false;
    }
  }, [toast]);

  const handleGenerateVideo = useCallback(async () => {
    if (!selectedProperty || !selectedAvatar || !generatedScript) return;
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationComplete(false);
    setGeneratedVideoUrl(null);
    setMotionVideos([]);
    setAvatarVideoUrl(null);
    setStatusMessage("Starting video generation...");
    
    try {
      const photosToInclude = selectedPhotos
        .filter(p => p.selected)
        .map(p => p.url);

      const selectedAvatarData = avatarsData?.photos?.find(a => a.id === selectedAvatar);
      const avatarImageKey = selectedAvatarData?.image_key || selectedAvatarData?.id;

      const response = await fetch("/api/property-tour/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          photos: photosToInclude,
          avatarId: selectedAvatar,
          avatarImageKey,
          script: generatedScript,
          backgroundType,
          includeBranding,
          property: {
            address: selectedProperty.address,
            city: selectedProperty.city,
            state: selectedProperty.state,
            listPrice: selectedProperty.listPrice,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start video generation");
      }

      const data = await response.json();
      const jobId = data.jobId;
      setCurrentJobId(jobId);
      
      toast({
        title: "Video Generation Started",
        description: `Estimated time: ${data.estimatedTime || "2-3 minutes"}`,
      });
      
      const pollInterval = setInterval(async () => {
        const isDone = await pollJobStatus(jobId);
        if (isDone) {
          clearInterval(pollInterval);
        }
      }, 5000);
      
    } catch (error: any) {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      });
    }
  }, [selectedProperty, selectedAvatar, generatedScript, selectedPhotos, backgroundType, includeBranding, toast, pollJobStatus, avatarsData]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!currentJobId || !selectedProperty) return;
    
    setIsSavingToLibrary(true);
    try {
      const response = await fetch("/api/property-tour/save-to-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobId: currentJobId,
          address: `${selectedProperty.address}, ${selectedProperty.city}`,
          script: generatedScript,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save to library");
      }

      const data = await response.json();
      setSavedVideos(data.savedVideos || []);
      setSavedToLibrary(true);
      toast({
        title: "Saved to Library",
        description: `${data.savedVideos?.length || 0} videos saved to your library.`,
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save videos to library",
        variant: "destructive",
      });
    } finally {
      setIsSavingToLibrary(false);
    }
  }, [currentJobId, selectedProperty, generatedScript, toast]);

  const handleOpenShareDialog = useCallback(() => {
    if (!selectedProperty) return;
    
    const defaultContent = `🏠 Just listed! Beautiful property at ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}. Listed at $${selectedProperty.listPrice.toLocaleString()}. Check out this virtual tour! #RealEstate #PropertyTour #NewListing`;
    setShareContent(defaultContent);
    
    const defaultVideo = avatarVideoUrl || (motionVideos.length > 0 ? motionVideos[0] : "");
    setSelectedVideoForShare(defaultVideo);
    setSelectedPlatform("");
    setShowShareDialog(true);
  }, [selectedProperty, avatarVideoUrl, motionVideos]);

  const handleShareToSocial = useCallback(async () => {
    if (!selectedPlatform || !selectedVideoForShare || !shareContent) {
      toast({
        title: "Missing Information",
        description: "Please select a platform, video, and add content text.",
        variant: "destructive",
      });
      return;
    }

    if (!savedToLibrary || savedVideos.length === 0) {
      toast({
        title: "Save to Library First",
        description: "Please save videos to your library before sharing to social media.",
        variant: "destructive",
      });
      return;
    }

    const selectedVideo = savedVideos.find(v => v.url === selectedVideoForShare);
    if (!selectedVideo) {
      toast({
        title: "Error",
        description: "Selected video not found. Please save videos first.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      const response = await apiRequest("POST", "/api/social/post", {
        platform: selectedPlatform,
        content: shareContent,
        mediaType: "video",
        mediaId: selectedVideo.id,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to share to social media");
      }

      toast({
        title: "Shared Successfully",
        description: `Your property tour video has been shared to ${selectedPlatform}.`,
      });
      setShowShareDialog(false);
    } catch (error: any) {
      toast({
        title: "Share Failed",
        description: error.message || "Failed to share to social media",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  }, [selectedPlatform, selectedVideoForShare, shareContent, savedToLibrary, savedVideos, toast]);

  const getVideoOptions = useCallback(() => {
    const options: { value: string; label: string }[] = [];
    if (avatarVideoUrl) {
      options.push({ value: avatarVideoUrl, label: "Avatar Narration" });
    }
    motionVideos.forEach((url, index) => {
      options.push({ value: url, label: `Motion Clip ${index + 1}` });
    });
    return options;
  }, [avatarVideoUrl, motionVideos]);

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2:
        return selectedProperty !== null;
      case 3:
        return selectedPhotos.filter(p => p.selected).length > 0;
      case 4:
        return selectedAvatar !== "" && generatedScript.trim() !== "";
      default:
        return true;
    }
  };

  const goToNextStep = () => {
    if (currentStep < 4 && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const selectedPhotoCount = selectedPhotos.filter(p => p.selected).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Property Tour Studio
        </CardTitle>
        <CardDescription>
          Create professional property tour videos with AI-powered narration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.id
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                data-testid={`step-${step.id}`}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {currentStep === 1 && (
          <div className="space-y-4" data-testid="step-1-content">
            <PropertySelector
              onSelectProperty={handlePropertySelect}
              selectedProperty={selectedProperty}
            />
            {selectedProperty && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Selected Property</h4>
                <p className="text-sm" data-testid="selected-property-address">
                  {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state}
                </p>
                <p className="text-sm text-muted-foreground">
                  ${selectedProperty.listPrice.toLocaleString()} • {selectedProperty.photoUrls?.length || 0} photos available
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4" data-testid="step-2-content">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Arrange Tour Photos</h4>
                <p className="text-sm text-muted-foreground">
                  Select and drag to reorder photos for your tour
                </p>
              </div>
              <Badge variant="secondary" data-testid="photo-count">
                {selectedPhotoCount} of {selectedPhotos.length} selected
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {selectedPhotos.map((photo, index) => (
                <div
                  key={photo.url}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-move ${
                    photo.selected
                      ? "border-primary"
                      : "border-transparent opacity-50"
                  } ${draggedIndex === index ? "scale-95 opacity-70" : ""}`}
                  data-testid={`photo-item-${index}`}
                >
                  <img
                    src={photo.url}
                    alt={`Property photo ${index + 1}`}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <div className="bg-black/70 text-white px-2 py-1 rounded text-xs">
                      #{index + 1}
                    </div>
                    <GripVertical className="h-4 w-4 text-white drop-shadow" />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Checkbox
                      checked={photo.selected}
                      onCheckedChange={() => handlePhotoToggle(index)}
                      className="bg-white/90"
                      data-testid={`photo-checkbox-${index}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {selectedPhotos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No photos available for this property
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6" data-testid="step-3-content">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="avatar-select">Select Avatar</Label>
                  <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                    <SelectTrigger id="avatar-select" data-testid="avatar-select">
                      <SelectValue placeholder="Choose an avatar for narration" />
                    </SelectTrigger>
                    <SelectContent>
                      {avatarsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading avatars...
                        </SelectItem>
                      ) : avatarsData?.photos && avatarsData.photos.length > 0 ? (
                        avatarsData.photos.map((avatar) => (
                          <SelectItem key={avatar.id} value={avatar.id}>
                            <div className="flex items-center gap-2">
                              {avatar.image_url ? (
                                <img
                                  src={avatar.image_url}
                                  alt={avatar.avatar_name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-6 h-6" />
                              )}
                              {avatar.avatar_name}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No avatars available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Background Style</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {BACKGROUND_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={backgroundType === option.value ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-3"
                        onClick={() => setBackgroundType(option.value)}
                        data-testid={`background-${option.value}`}
                      >
                        <option.icon className="h-5 w-5" />
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="branding-toggle">Agent Branding</Label>
                    <p className="text-xs text-muted-foreground">
                      Include your branding overlay
                    </p>
                  </div>
                  <Switch
                    id="branding-toggle"
                    checked={includeBranding}
                    onCheckedChange={setIncludeBranding}
                    data-testid="branding-toggle"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="script-textarea">Tour Script</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateScript}
                    disabled={generateScriptMutation.isPending || !selectedProperty}
                    data-testid="generate-script-btn"
                  >
                    {generateScriptMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Generate Script
                  </Button>
                </div>
                <Textarea
                  id="script-textarea"
                  placeholder="Your property tour narration script will appear here. Click 'Generate Script' to create one based on the property's MLS data, or write your own."
                  value={generatedScript}
                  onChange={(e) => setGeneratedScript(e.target.value)}
                  className="min-h-[200px]"
                  data-testid="script-textarea"
                />
                <p className="text-xs text-muted-foreground">
                  {generatedScript.length} characters
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6" data-testid="step-4-content">
            <div className="p-6 bg-muted rounded-lg space-y-4">
              <h4 className="font-medium">Tour Summary</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Property:</span>
                  <p data-testid="summary-property">{selectedProperty?.address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Photos:</span>
                  <p data-testid="summary-photos">{selectedPhotoCount} selected</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avatar:</span>
                  <p data-testid="summary-avatar">
                    {avatarsData?.photos?.find(a => a.id === selectedAvatar)?.avatar_name || "Selected"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Background:</span>
                  <p data-testid="summary-background" className="capitalize">{backgroundType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Branding:</span>
                  <p data-testid="summary-branding">{includeBranding ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Script:</span>
                  <p data-testid="summary-script">{generatedScript.length} characters</p>
                </div>
              </div>
            </div>

            {isGenerating && (
              <div className="space-y-2" data-testid="generation-progress">
                <div className="flex items-center justify-between text-sm">
                  <span>{statusMessage || "Generating video..."}</span>
                  <span>{generationProgress}%</span>
                </div>
                <Progress value={generationProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  This may take 2-3 minutes. Please keep this page open.
                </p>
              </div>
            )}

            {generationComplete && (
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4" data-testid="generation-complete">
                <div className="flex items-center gap-3">
                  <Check className="h-6 w-6 text-green-500" />
                  <div>
                    <h4 className="font-medium text-green-600 dark:text-green-400">
                      Property Tour Videos Generated
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {motionVideos.length} motion clips{avatarVideoUrl ? " and avatar narration" : ""} are ready.
                    </p>
                  </div>
                </div>
                
                {avatarVideoUrl && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Avatar Narration</h5>
                    <div className="rounded-lg overflow-hidden border bg-black max-w-2xl mx-auto">
                      <video
                        src={avatarVideoUrl}
                        controls
                        className="w-full aspect-video"
                        data-testid="avatar-video-player"
                      />
                      <div className="bg-muted p-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Avatar Introduction</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 gap-1 text-xs"
                          asChild
                        >
                          <a href={avatarVideoUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3" />
                            Save
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {motionVideos.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Property Motion Clips</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {motionVideos.map((videoUrl, index) => (
                        <div key={index} className="rounded-lg overflow-hidden border bg-black">
                          <video
                            src={videoUrl}
                            controls
                            className="w-full aspect-video"
                            data-testid={`motion-video-${index}`}
                          />
                          <div className="bg-muted p-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Clip {index + 1}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 gap-1 text-xs"
                              asChild
                            >
                              <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                                <Download className="h-3 w-3" />
                                Save
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={handleSaveToLibrary}
                    disabled={savedToLibrary || isSavingToLibrary}
                    data-testid="save-to-library-btn"
                  >
                    {isSavingToLibrary ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedToLibrary ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Library className="h-4 w-4" />
                    )}
                    {savedToLibrary ? "Saved to Library" : "Save to Library"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={handleOpenShareDialog}
                    data-testid="share-to-social-btn"
                  >
                    <Share2 className="h-4 w-4" />
                    Share to Social Media
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setGenerationComplete(false);
                      setGeneratedVideoUrl(null);
                      setMotionVideos([]);
                      setAvatarVideoUrl(null);
                      setSavedToLibrary(false);
                      setSavedVideos([]);
                      setCurrentStep(1);
                    }}
                    data-testid="create-another-btn"
                  >
                    <Video className="h-4 w-4" />
                    Create Another Tour
                  </Button>
                </div>
              </div>
            )}

            {!isGenerating && !generationComplete && (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleGenerateVideo}
                  disabled={!canProceedToStep(4)}
                  className="gap-2"
                  data-testid="generate-video-btn"
                >
                  <Video className="h-5 w-5" />
                  Generate Tour Video
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStep === 1}
            data-testid="prev-step-btn"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < 4 ? (
            <Button
              onClick={goToNextStep}
              disabled={!canProceedToStep(currentStep + 1)}
              data-testid="next-step-btn"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </CardContent>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px]" data-testid="share-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share to Social Media
            </DialogTitle>
            <DialogDescription>
              Share your property tour video to social media platforms.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!savedToLibrary && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                <p className="text-yellow-600 dark:text-yellow-400">
                  Please save videos to your library first before sharing to social media.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="platform-select">Platform</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger id="platform-select" data-testid="share-platform-select">
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      <div className="flex items-center gap-2">
                        <platform.icon className="h-4 w-4" />
                        {platform.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-select">Video to Share</Label>
              <Select value={selectedVideoForShare} onValueChange={setSelectedVideoForShare}>
                <SelectTrigger id="video-select" data-testid="share-video-select">
                  <SelectValue placeholder="Select a video" />
                </SelectTrigger>
                <SelectContent>
                  {getVideoOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="share-content">Post Content</Label>
              <Textarea
                id="share-content"
                value={shareContent}
                onChange={(e) => setShareContent(e.target.value)}
                className="min-h-[120px]"
                placeholder="Write your post content..."
                data-testid="share-content-textarea"
              />
              <p className="text-xs text-muted-foreground">
                {shareContent.length} characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShareDialog(false)}
              data-testid="share-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleShareToSocial}
              disabled={isPosting || !savedToLibrary || !selectedPlatform}
              data-testid="share-post-btn"
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {isPosting ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
