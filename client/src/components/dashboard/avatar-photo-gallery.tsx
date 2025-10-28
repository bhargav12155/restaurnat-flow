import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon, ZoomIn, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Photo {
  id?: string;
  url: string;
  thumbnail?: string;
  name?: string;
  type?: string;
}

interface PhotoGalleryData {
  group_id: string;
  photos: Photo[];
  count: number;
}

interface AvatarPhotoGalleryProps {
  groupId: string;
}

export function AvatarPhotoGallery({ groupId }: AvatarPhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Fetch photos for this avatar group
  const { data: photoData, isLoading } = useQuery<PhotoGalleryData>({
    queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
    enabled: !!groupId,
  });

  const photos = photoData?.photos || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
        <span className="ml-2 text-sm text-gray-500">Loading photos...</span>
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <Alert className="border-[#D4AF37]/30 bg-[#D4AF37]/5">
        <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
        <AlertDescription>
          No photos available yet. Photos will appear here after generation or upload.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            Generated Photos ({photos.length})
          </h4>
          <span className="text-xs text-gray-500">Click to view full size</span>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {photos.map((photo, index) => (
            <button
              key={photo.id || index}
              onClick={() => setSelectedPhoto(photo)}
              className="relative aspect-square rounded-lg overflow-hidden border-2 border-[#D4AF37]/20 hover:border-[#D4AF37] transition-all duration-200 hover:shadow-lg hover:scale-105 group"
              data-testid={`photo-${index}`}
            >
              <img
                src={photo.thumbnail || photo.url}
                alt={photo.name || `Avatar photo ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=Photo+${index + 1}&background=D4AF37&color=fff&size=200`;
                }}
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>

              {/* Photo Number Badge */}
              <div className="absolute top-1 right-1 bg-[#D4AF37] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                #{index + 1}
              </div>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>Total: {photos.length} photos</span>
          <span className="text-[#D4AF37] font-medium">Ready for training</span>
        </div>
      </div>

      {/* Full-Size Photo Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">
              {selectedPhoto?.name || 'Avatar Photo'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPhoto && (
            <div className="space-y-4">
              {/* Full-size image */}
              <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg border-2 border-[#D4AF37]/30">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.name || 'Avatar photo'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://ui-avatars.com/api/?name=Avatar+Photo&background=D4AF37&color=fff&size=800';
                  }}
                />
              </div>

              {/* Photo Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedPhoto.url) {
                      window.open(selectedPhoto.url, '_blank');
                    }
                  }}
                  className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedPhoto(null)}
                  className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
