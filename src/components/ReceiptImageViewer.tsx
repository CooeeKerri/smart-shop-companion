import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ReceiptImageViewerProps {
  receiptId: string;
  imageUrl?: string | null;
  compact?: boolean;
}

const ReceiptImageViewer = ({ receiptId, imageUrl, compact = false }: ReceiptImageViewerProps) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadImages();
  }, [receiptId]);

  const loadImages = async () => {
    try {
      // First try image_paths column
      const { data: receipt } = await supabase
        .from('receipts')
        .select('image_url, user_id')
        .eq('id', receiptId)
        .single();

      if (!receipt) return;

      // List files in the user's folder matching this receipt ID
      const { data: files } = await supabase.storage
        .from('receipts')
        .list(receipt.user_id, { search: receiptId });

      const paths = (files || [])
        .filter((f) => f.name.startsWith(receiptId))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => `${receipt.user_id}/${f.name}`);

      // Fall back to image_url if no files found via listing
      if (paths.length === 0 && receipt.image_url) {
        paths.push(receipt.image_url);
      }

      if (paths.length === 0) {
        setLoading(false);
        return;
      }

      // Get signed URLs for all images
      const urls: string[] = [];
      for (const path of paths) {
        const { data } = await supabase.storage
          .from('receipts')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }

      setImageUrls(urls);
    } catch (err) {
      console.error('Error loading receipt images:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || imageUrls.length === 0) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Image className="h-3.5 w-3.5" />
        <span>{loading ? 'Loading…' : 'No receipt image'}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-muted">
            <img
              src={imageUrls[0]}
              alt="Receipt"
              className="h-full w-full object-cover"
            />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-lg p-2">
          <ImageCarousel
            urls={imageUrls}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Image className="h-3.5 w-3.5" />
          View receipt ({imageUrls.length} {imageUrls.length === 1 ? 'photo' : 'photos'})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-2">
        <ImageCarousel
          urls={imageUrls}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
        />
      </DialogContent>
    </Dialog>
  );
};

const ImageCarousel = ({
  urls,
  currentIndex,
  setCurrentIndex,
}: {
  urls: string[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
}) => (
  <div className="relative">
    <img
      src={urls[currentIndex]}
      alt={`Receipt page ${currentIndex + 1}`}
      className="w-full rounded-lg max-h-[70vh] object-contain"
    />
    {urls.length > 1 && (
      <>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
          {currentIndex + 1} / {urls.length}
        </div>
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {currentIndex < urls.length - 1 && (
          <button
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </>
    )}
  </div>
);

export default ReceiptImageViewer;
