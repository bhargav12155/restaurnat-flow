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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ai");
  const [previewImage, setPreviewImage] = useState<string | null>(selectedImage || null);

  // AI Generate state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(
    platform ? PLATFORM_ASPECT_SUGGESTIONS[platform] || "1:1" : "1:1"
  );
  const [style, setStyle] = useState("photorealistic");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [logoOption, setLogoOption] = useState<"none" | "primary" | "broker" | "both">("none");

  // Stock Images state
  const [stockQuery, setStockQuery] = useState("real estate");
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
      logoOption: logoOption !== "none" ? logoOption : undefined 
    });
  };

  const handleTemplateClick = (template: ImageTemplate) => {
    setAiPrompt(template.prompt);
    if (template.suggestedAspectRatio) {
      setAspectRatio(template.suggestedAspectRatio);
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
    onSelect("");
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
    <div className={`space-y-4 ${className}`} data-testid="image-picker">
      {/* Preview Section */}
      {previewImage && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={previewImage}
                  alt="Selected"
                  className="w-full h-full object-cover"
                  data-testid="img-preview"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-2">Selected Image</p>
                <p className="text-xs text-muted-foreground truncate mb-3">{previewImage}</p>
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai" data-testid="tab-ai-generate">
            <Wand2 className="h-4 w-4 mr-2" />
            AI Generate
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock-images">
            <Search className="h-4 w-4 mr-2" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="mls" data-testid="tab-mls-photos">
            <Home className="h-4 w-4 mr-2" />
            MLS Photos
          </TabsTrigger>
        </TabsList>

        {/* AI Generate Tab */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          {/* Templates */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick Templates</Label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateClick(template)}
                    data-testid={`button-template-${template.id}`}
                    className="text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-prompt">Image Description</Label>
              <div className="flex items-center gap-2">
                <Select value={logoOption} onValueChange={(v) => setLogoOption(v as typeof logoOption)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-logo-option">
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
              placeholder="Describe the image you want to generate... e.g., 'Modern luxury home with pool at sunset'"
              rows={3}
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

          {/* Options Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger data-testid="select-aspect-ratio">
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
                <p className="text-xs text-muted-foreground">
                  Recommended for {platform}: {PLATFORM_ASPECT_SUGGESTIONS[platform]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger data-testid="select-style">
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
            className="w-full"
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

        {/* Stock Images Tab */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
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
                    alt={`Property photo ${index + 1}`}
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
              <p className="mb-2">No MLS photos available</p>
              <p className="text-xs">
                Select a property first to see its photos here
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
