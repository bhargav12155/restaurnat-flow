import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";

interface MediaAsset {
  id: string;
  userId: string;
  type: "photo" | "video";
  source: "upload" | "heygen" | "library";
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  avatarId: string | null;
  fileSize: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  metadata: unknown;
  createdAt: string;
}

interface MediaLibraryProps {
  onSelectMedia?: (mediaIds: string[]) => void;
  selectedMediaIds?: string[];
  multiSelect?: boolean;
  typeFilter?: "photo" | "video" | "all";
}

export function MediaLibrary({
  onSelectMedia,
  selectedMediaIds = [],
  multiSelect = true,
  typeFilter = "all",
}: MediaLibraryProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "photo" | "video">(typeFilter);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Sync internal state with prop to ensure controlled behavior
  const selectedIds = selectedMediaIds;

  // Fetch media assets
  const { data: mediaAssets = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media", filter !== "all" ? filter : undefined],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "type",
        file.type.startsWith("video/") ? "video" : "photo",
      );
      formData.append("source", "upload");

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload successful",
        description: "Your media has been uploaded to the library",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      setUploadFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadMutation.mutate(uploadFile);
    }
  };

  const toggleSelection = (mediaId: string) => {
    let newSelection: string[];

    if (multiSelect) {
      newSelection = selectedIds.includes(mediaId)
        ? selectedIds.filter((id) => id !== mediaId)
        : [...selectedIds, mediaId];
    } else {
      newSelection = selectedIds.includes(mediaId) ? [] : [mediaId];
    }

    // Notify parent of selection change - parent manages state
    onSelectMedia?.(newSelection);
  };

  const filteredAssets = mediaAssets.filter((asset) => {
    if (filter === "all") return true;
    return asset.type === filter;
  });

  return (
    <div className="space-y-4">
      {/* Header with filters and upload - responsive layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium whitespace-nowrap">Filter:</Label>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-media-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="filter-all">
                All Media
              </SelectItem>
              <SelectItem value="photo" data-testid="filter-photo">
                Photos
              </SelectItem>
              <SelectItem value="video" data-testid="filter-video">
                Videos
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="flex-1 sm:w-48 lg:w-64"
            data-testid="input-media-upload"
          />
          <Button
            onClick={handleUpload}
            disabled={!uploadFile || uploadMutation.isPending}
            size="default"
            className="shrink-0"
            data-testid="button-upload-media"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Selection summary */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg">
          <span
            className="text-sm font-medium"
            data-testid="text-selection-count"
          >
            {selectedIds.length} {selectedIds.length === 1 ? "item" : "items"}{" "}
            selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectMedia?.([]);
            }}
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      )}

      {/* Media grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your media library...</p>
          </div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <div className="text-center space-y-3 max-w-sm">
              <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                {filter === "photo" ? (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                ) : filter === "video" ? (
                  <FileVideo className="h-8 w-8 text-muted-foreground/60" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground/60" />
                )}
              </div>
              <div className="text-base font-medium text-foreground">
                {filter === "all"
                  ? "No media in your library yet"
                  : `No ${filter}s in your library yet`}
              </div>
              <p className="text-sm text-muted-foreground">
                Upload some media using the button above to get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className={`group relative cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.02] ${
                selectedIds.includes(asset.id)
                  ? "ring-2 ring-primary shadow-xl scale-[1.02]"
                  : "hover:ring-1 hover:ring-border"
              }`}
              onClick={() => toggleSelection(asset.id)}
              data-testid={`card-media-${asset.id}`}
            >
              <CardContent className="p-0">
                {/* Media preview - larger and better aspect ratio */}
                <div className="aspect-video relative overflow-hidden rounded-t-lg bg-gradient-to-br from-muted to-muted/50">
                  {asset.type === "photo" ? (
                    <img
                      src={asset.url}
                      alt={asset.title || "Media asset"}
                      className="w-full h-full object-contain bg-black/5"
                      loading="lazy"
                    />
                  ) : asset.thumbnailUrl ? (
                    // Show video thumbnail if available
                    <div className="relative w-full h-full">
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.title || "Video thumbnail"}
                        className="w-full h-full object-contain bg-black/5"
                        loading="lazy"
                      />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                        <div className="bg-white/90 rounded-full p-3 group-hover:bg-white group-hover:scale-110 transition-all shadow-lg">
                          <FileVideo className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Fallback for videos without thumbnails
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                      <div className="bg-white/90 rounded-full p-4 mb-2 group-hover:scale-110 transition-transform shadow-lg">
                        <FileVideo className="h-10 w-10 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground font-medium">Video File</span>
                    </div>
                  )}

                  {/* Selection indicator - larger and more visible */}
                  {selectedIds.includes(asset.id) && (
                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-2 shadow-lg animate-in zoom-in-50 duration-200">
                      <Check className="h-5 w-5 stroke-[3]" />
                    </div>
                  )}

                  {/* Type badge - improved visibility */}
                  <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-lg">
                    {asset.type === "photo" ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : (
                      <FileVideo className="h-3.5 w-3.5" />
                    )}
                    {asset.type.toUpperCase()}
                  </div>

                  {/* Duration badge for videos */}
                  {asset.type === "video" && asset.duration && (
                    <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                      {Math.floor(asset.duration / 60)}:{String(Math.floor(asset.duration % 60)).padStart(2, '0')}
                    </div>
                  )}
                </div>

                {/* Media info - compact and clean */}
                <div className="p-3 bg-gradient-to-b from-background to-muted/20 space-y-2">
                  <div
                    className="text-sm font-semibold truncate group-hover:text-primary transition-colors leading-tight"
                    data-testid={`text-title-${asset.id}`}
                    title={asset.title || "Untitled"}
                  >
                    {asset.title || "Untitled"}
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center capitalize text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {asset.source}
                    </span>
                    {asset.fileSize && (
                      <span className="text-xs font-medium text-muted-foreground/70">
                        {(asset.fileSize / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                    {asset.width && asset.height && (
                      <span className="text-xs font-medium text-muted-foreground/70">
                        {asset.width} × {asset.height}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
