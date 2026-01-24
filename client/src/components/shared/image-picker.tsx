import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { useBusinessType } from "@/hooks/useBusinessType";
import { getBusinessLabels } from "@/lib/businessType";
import { apiRequest } from "@/lib/queryClient";
import {
  Wand2,
  Search,
  Upload,
  Home,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  Sparkles,
  RefreshCw,
  Download,
  FolderPlus,
  Video,
} from "lucide-react";

interface ImageTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  suggestedAspectRatio: string;
}

interface StockImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  alt: string;
  photographer?: string;
}

interface ImagePickerProps {
  onSelect: (imageUrl: string) => void;
  platform?: string;
  mlsPhotos?: string[];
  selectedImage?: string | null;
  className?: string;
}

const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "4:3", label: "Standard (4:3)" },
];

const STYLE_OPTIONS = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "illustration", label: "Illustration" },
  { value: "artistic", label: "Artistic" },
];

const PLATFORM_ASPECT_SUGGESTIONS: Record<string, string> = {
  instagram: "1:1",
  facebook: "16:9",
  linkedin: "16:9",
  x: "16:9",
  twitter: "16:9",
};

export function ImagePicker({
  onSelect,
  platform,
  mlsPhotos = [],
  selectedImage,
  className = "",
}: ImagePickerProps) {
  const { data: businessData, businessType } = useBusinessType();
  const { typeLabel: businessTypeLabel } = getBusinessLabels(
    businessData?.businessType,
    businessData?.businessSubtype
  );
  const businessLabelLower = (businessTypeLabel || 'restaurant').toLowerCase();
  const defaultStockQuery = `${businessLabelLower} visuals`;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ai");
  const [previewImage, setPreviewImage] = useState<string | null>(selectedImage || null);

  // Sync previewImage when selectedImage prop changes
  useEffect(() => {
    if (selectedImage) {
      setPreviewImage(selectedImage);
    }
  }, [selectedImage]);

  // AI Generate state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(
    platform ? PLATFORM_ASPECT_SUGGESTIONS[platform] || "1:1" : "1:1"
  );
  const [style, setStyle] = useState("photorealistic");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [logoOption, setLogoOption] = useState<"none" | "primary" | "broker" | "both">("none");
  const [imageReferenceUrl, setImageReferenceUrl] = useState<string | null>(null);
  const [imageReferenceUploading, setImageReferenceUploading] = useState(false);

  // AI Video state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9");
  const [videoDuration, setVideoDuration] = useState<"5" | "10">("5");
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [videoGenerationStep, setVideoGenerationStep] = useState<"idle" | "generating-image" | "generating-video" | "done">("idle");
  const [videoReferenceUrl, setVideoReferenceUrl] = useState<string | null>(null);
  const [videoReferenceUploading, setVideoReferenceUploading] = useState(false);

  // Stock Images state
  const [stockQuery, setStockQuery] = useState(defaultStockQuery);
  const [stockQueryUserUpdated, setStockQueryUserUpdated] = useState(false);
  const [stockOrientation, setStockOrientation] = useState("landscape");
  const [debouncedQuery, setDebouncedQuery] = useState(stockQuery);

  // Update aspect ratio when platform changes
  useEffect(() => {
    if (platform && PLATFORM_ASPECT_SUGGESTIONS[platform]) {
      setAspectRatio(PLATFORM_ASPECT_SUGGESTIONS[platform]);
    }
  }, [platform]);

  // Debounce stock search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(stockQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [stockQuery]);

  useEffect(() => {
    if (!stockQueryUserUpdated && stockQuery !== defaultStockQuery) {
      setStockQuery(defaultStockQuery);
      setDebouncedQuery(defaultStockQuery);
    }
  }, [defaultStockQuery, stockQuery, stockQueryUserUpdated]);

  // Fetch templates
  const { data: templatesData } = useQuery<{ templates: ImageTemplate[] }>({
    queryKey: ["/api/images/templates"],
  });

  // Fetch stock images
  const { data: stockData, isLoading: stockLoading } = useQuery<{ images: StockImage[] }>({
    queryKey: ["/api/images/stock", debouncedQuery, stockOrientation],
    queryFn: async () => {
      const params = new URLSearchParams({
        query: debouncedQuery,
        orientation: stockOrientation,
        perPage: "12",
      });
      const response = await fetch(`/api/images/stock?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stock images");
      return response.json();
    },
    enabled: activeTab === "stock" && debouncedQuery.length > 0,
  });

  // AI Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (params: { prompt: string; aspectRatio: string; style: string; logoOption?: string }) => {
      const response = await apiRequest("POST", "/api/images/generate", params);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setPreviewImage(data.imageUrl); // Automatically select the generated image
        toast({
          title: "Image Generated!",
          description: "Your AI image is ready and selected. Click Confirm to attach it.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your image.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({ 
      prompt: aiPrompt, 
      aspectRatio, 
      style, 
      logoOption: logoOption !== "none" ? logoOption : undefined,
      referenceImageUrl: imageReferenceUrl || undefined,
    });
  };

  const handleTemplateClick = (template: ImageTemplate) => {
    setAiPrompt(template.prompt);
    if (template.suggestedAspectRatio) {
      setAspectRatio(template.suggestedAspectRatio);
    }
  };

  const handleReferenceImageUpload = async (file: File, type: "image" | "video") => {
    const setUploading = type === "image" ? setImageReferenceUploading : setVideoReferenceUploading;
    const setUrl = type === "image" ? setImageReferenceUrl : setVideoReferenceUrl;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/upload-reference", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }
      
      const data = await response.json();
      setUrl(data.url);
      toast({
        title: "Reference Image Uploaded",
        description: "Your reference image will guide the AI generation.",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload reference image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // AI Video generation (2-step: generate image, then animate with Kling)
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your video.",
        variant: "destructive",
      });
      return;
    }

    try {
      setVideoGenerationStep("generating-image");
      setGeneratedVideo(null);

      // Step 1: Generate an AI image from the prompt
      const imageResponse = await apiRequest("POST", "/api/images/generate", {
        prompt: videoPrompt,
        aspectRatio: videoAspectRatio,
        style: "photorealistic",
        referenceImageUrl: videoReferenceUrl || undefined,
      });
      const imageData = await imageResponse.json();
      
      if (!imageData.imageUrl) {
        throw new Error("Failed to generate image for video");
      }

      setVideoGenerationStep("generating-video");

      // Step 2: Generate motion video from the image using Kling
      const videoResponse = await apiRequest("POST", "/api/kling/generate-motion", {
        imageUrl: imageData.imageUrl,
        prompt: videoPrompt,
        duration: videoDuration,
        aspectRatio: videoAspectRatio === "9:16" ? "9:16" : "16:9",
      });
      const videoData = await videoResponse.json();

      if (!videoData.videoUrl) {
        throw new Error("Video is being generated. Check back in a few minutes.");
      }

      setGeneratedVideo(videoData.videoUrl);
      setPreviewImage(videoData.videoUrl);
      setVideoGenerationStep("done");
      
      toast({
        title: "Video Generated!",
        description: "Your AI video is ready. Click Confirm to attach it.",
      });
    } catch (error: any) {
      setVideoGenerationStep("idle");
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to generate video. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImageSelect = (imageUrl: string) => {
    setPreviewImage(imageUrl);
  };

  const confirmSelection = () => {
    if (previewImage) {
      onSelect(previewImage);
      toast({
        title: "Image Selected",
        description: "Image has been attached to your post.",
      });
    }
  };

  const clearSelection = () => {
    setPreviewImage(null);
    setGeneratedImage(null);
    // Don't call onSelect("") here - just clear local preview state
    // The user can close the dialog without selecting anything
  };

  // Download generated image to device
  const handleDownloadImage = async () => {
    if (!generatedImage) return;
    
    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Image Downloaded",
        description: "Your AI-generated image has been saved to your device.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Save to library mutation
  const saveToLibraryMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest("POST", "/api/brand-assets", {
        type: "generated_image",
        url: imageUrl,
        name: `AI Generated - ${new Date().toLocaleDateString()}`,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save image to library");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Saved to Library",
        description: "Your AI-generated image has been saved to your brand assets for future use.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Could not save image to library. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUploadComplete = (uploadedUrl: string) => {
    setPreviewImage(uploadedUrl);
    toast({
      title: "Upload Complete",
      description: "Your image has been uploaded successfully.",
    });
  };

  const getUploadParams = useCallback(async () => {
    const response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "image/jpeg" }),
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadUrl,
      fileUrl: data.fileUrl,
    };
  }, []);

  const templates = templatesData?.templates || [];
  const stockImages = stockData?.images || [];

  return (
    <div className={`space-y-3 ${className}`} data-testid="image-picker">
      {/* Preview Section */}
      {previewImage && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={previewImage}
                  alt="Selected"
                  className="w-full h-full object-cover"
                  data-testid="img-preview"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">Selected Image</p>
                <a 
                  href={previewImage} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mb-2 inline-block"
                >
                  View larger image ↗
                </a>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={confirmSelection}
                    data-testid="button-confirm-image"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearSelection}
                    data-testid="button-remove-image"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="ai" data-testid="tab-ai-generate" className="text-xs px-1">
            <Wand2 className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">AI Image</span>
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock-images" className="text-xs px-1">
            <Search className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload" className="text-xs px-1">
            <Upload className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Upload</span>
          </TabsTrigger>
          <TabsTrigger value="mls" data-testid="tab-mls-photos" className="text-xs px-1">
            <Home className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Photos</span>
          </TabsTrigger>
        </TabsList>

        {/* AI Generate Tab */}
        <TabsContent value="ai" className="space-y-3 mt-3">
          {/* Templates */}
          {templates.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Quick Templates</Label>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateClick(template)}
                    data-testid={`button-template-${template.id}`}
                    className="text-xs h-7 px-2"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-prompt" className="text-xs">Image Description</Label>
              <div className="flex items-center gap-2">
                <Select value={logoOption} onValueChange={(v) => setLogoOption(v as typeof logoOption)}>
                  <SelectTrigger className="w-[140px] h-7 text-xs" data-testid="select-logo-option">
                    <SelectValue placeholder="Add logo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Logo</SelectItem>
                    <SelectItem value="primary">My Logo</SelectItem>
                    <SelectItem value="broker">Broker Logo</SelectItem>
                    <SelectItem value="both">Both Logos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              rows={2}
              className="text-sm"
              data-testid="textarea-ai-prompt"
            />
            {logoOption !== "none" && (
              <p className="text-xs text-muted-foreground">
                {logoOption === "both" 
                  ? "Both logos will be overlaid on the generated image (compliant with brokerage requirements)"
                  : logoOption === "broker" 
                    ? "Broker logo will be overlaid on the generated image"
                    : "Your logo will be overlaid on the generated image"}
              </p>
            )}
          </div>

          {/* Reference Image Upload */}
          <div className="space-y-1">
            <Label className="text-xs">Reference Image (Optional)</Label>
            {imageReferenceUrl ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                  <img src={imageReferenceUrl} alt="Reference" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Reference uploaded</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImageReferenceUrl(null)}
                  data-testid="button-remove-image-reference"
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-2 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="image-reference-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReferenceImageUpload(file, "image");
                    e.target.value = "";
                  }}
                  data-testid="input-image-reference"
                />
                <label htmlFor="image-reference-upload" className="cursor-pointer">
                  {imageReferenceUploading ? (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span className="text-xs">Upload reference image</span>
                    </div>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Options Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger data-testid="select-aspect-ratio" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {platform && PLATFORM_ASPECT_SUGGESTIONS[platform] && (
                <p className="text-[10px] text-muted-foreground">
                  Recommended: {PLATFORM_ASPECT_SUGGESTIONS[platform]}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger data-testid="select-style" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !aiPrompt.trim()}
            className="w-full h-9"
            data-testid="button-generate-image"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>

          {/* Generated Image Preview */}
          {generatedImage && (
            <div className="space-y-3">
              <Label>Generated Image</Label>
              <div
                className="relative aspect-square max-w-xs mx-auto rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => handleImageSelect(generatedImage)}
                data-testid="generated-image-preview"
              >
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Badge className="bg-white text-black">Click to Select</Badge>
                </div>
              </div>
              
              {/* Download and Save buttons */}
              <div className="flex gap-2 justify-center max-w-xs mx-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadImage}
                  className="flex-1"
                  data-testid="button-download-generated"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveToLibraryMutation.mutate(generatedImage)}
                  disabled={saveToLibraryMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-to-library"
                >
                  {saveToLibraryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4 mr-2" />
                  )}
                  Save to Library
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* AI Video Tab */}
        <TabsContent value="video" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="video-prompt">Video Description</Label>
            <Textarea
              id="video-prompt"
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder={businessType === 'restaurant' ? "Describe the video you want to generate... e.g., 'Steaming pasta dish with fresh herbs being plated by a chef'" : businessType === 'home_services' ? "Describe the video you want to generate... e.g., 'Professional technician installing modern HVAC system'" : businessType === 'real_estate' ? "Describe the video you want to generate... e.g., 'Luxury home exterior with landscaped yard at sunset'" : "Describe the video you want to generate... e.g., 'Professional product showcase with modern lighting'"}
              rows={3}
              data-testid="textarea-video-prompt"
            />
            <p className="text-xs text-muted-foreground">
              We'll create an AI image from your description and animate it into a short video.
            </p>
          </div>

          {/* Reference Image Upload for Video */}
          <div className="space-y-2">
            <Label>Reference Image (Optional)</Label>
            {videoReferenceUrl ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                  <img src={videoReferenceUrl} alt="Reference" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Reference uploaded</p>
                  <p className="text-xs text-muted-foreground">AI will use this as inspiration</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVideoReferenceUrl(null)}
                  data-testid="button-remove-video-reference"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="video-reference-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReferenceImageUpload(file, "video");
                    e.target.value = "";
                  }}
                  data-testid="input-video-reference"
                />
                <label htmlFor="video-reference-upload" className="cursor-pointer">
                  {videoReferenceUploading ? (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Upload reference image</span>
                      <span className="text-xs">AI will match style/composition</span>
                    </div>
                  )}
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={videoAspectRatio} onValueChange={setVideoAspectRatio}>
                <SelectTrigger data-testid="select-video-aspect-ratio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                  <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={videoDuration} onValueChange={(v) => setVideoDuration(v as "5" | "10")}>
                <SelectTrigger data-testid="select-video-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerateVideo}
            disabled={videoGenerationStep !== "idle" && videoGenerationStep !== "done"}
            className="w-full"
            data-testid="button-generate-video"
          >
            {videoGenerationStep === "generating-image" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating image...
              </>
            ) : videoGenerationStep === "generating-video" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Animating video...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Generate Video
              </>
            )}
          </Button>

          {generatedVideo && (
            <div className="space-y-3">
              <Label>Generated Video</Label>
              <div className="relative max-w-md mx-auto rounded-lg overflow-hidden border">
                <video
                  src={generatedVideo}
                  controls
                  className="w-full"
                  data-testid="generated-video-preview"
                />
              </div>
              <div className="flex gap-2 justify-center max-w-md mx-auto">
                <Button
                  size="sm"
                  onClick={() => {
                    setPreviewImage(generatedVideo);
                    toast({
                      title: "Video Selected",
                      description: "Click Confirm above to attach the video to your post.",
                    });
                  }}
                  data-testid="button-select-video"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Select Video
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Stock Images Tab */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                value={stockQuery}
                onChange={(e) => {
                  setStockQueryUserUpdated(true);
                  setStockQuery(e.target.value);
                }}
                placeholder="Search stock images..."
                data-testid="input-stock-search"
              />
            </div>
            <Select value={stockOrientation} onValueChange={setStockOrientation}>
              <SelectTrigger className="w-36" data-testid="select-stock-orientation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {stockLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stockImages.length > 0 ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {stockImages.map((image) => (
                <div
                  key={image.id}
                  className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all ${
                    previewImage === image.url ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleImageSelect(image.url)}
                  data-testid={`stock-image-${image.id}`}
                >
                  <img
                    src={image.thumbnailUrl || image.url}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                  {previewImage === image.url && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-primary">
                        <Check className="h-3 w-3" />
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No images found. Try a different search term.</p>
            </div>
          )}
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Upload an image from your device
            </p>
            <ObjectUploader
              acceptedFileTypes="image/*"
              maxFileSize={10485760}
              onGetUploadParameters={getUploadParams}
              onComplete={handleUploadComplete}
              saveToLibrary={true}
              libraryType="photo"
              data-testid="uploader-image"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Image
            </ObjectUploader>
          </div>
        </TabsContent>

        {/* MLS Photos Tab */}
        <TabsContent value="mls" className="space-y-4 mt-4">
          {mlsPhotos.length > 0 ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {mlsPhotos.map((photoUrl, index) => (
                <div
                  key={index}
                  className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all ${
                    previewImage === photoUrl ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleImageSelect(photoUrl)}
                  data-testid={`mls-photo-${index}`}
                >
                  <img
                    src={photoUrl}
                    alt={`Menu photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {previewImage === photoUrl && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-primary">
                        <Check className="h-3 w-3" />
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No item photos available</p>
              <p className="text-xs">
                Select an item first to see its photos here
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
