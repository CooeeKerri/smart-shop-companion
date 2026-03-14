import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, FileText, X, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ScannedImage {
  id: string;
  file: File;
  preview: string;
}

const Scan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), file, preview: reader.result as string },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleProceed = async () => {
    if (!user || images.length === 0) return;
    setProcessing(true);

    try {
      // 1. Create ONE receipt record for the whole docket
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert({ user_id: user.id, status: 'pending' })
        .select('id')
        .single();

      if (receiptError || !receipt) {
        throw new Error('Failed to create receipt record');
      }

      // 2. Upload all images to storage
      const imagePaths: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = img.file.name.split('.').pop() || 'jpg';
        const storagePath = `${user.id}/${receipt.id}_${i + 1}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(storagePath, img.file);

        if (uploadError) {
          throw new Error(`Failed to upload image ${i + 1}: ${uploadError.message}`);
        }

        imagePaths.push(storagePath);
      }

      // 3. Update receipt with first image path
      await supabase
        .from('receipts')
        .update({ image_url: imagePaths[0] })
        .eq('id', receipt.id);

      // 4. Call OCR edge function with ALL images at once
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke(
        'process-receipt',
        { body: { receipt_id: receipt.id, image_paths: imagePaths } }
      );

      if (ocrError) {
        console.error('OCR error:', ocrError);
        toast({
          title: 'OCR warning',
          description: 'Some items may need manual review',
          variant: 'destructive',
        });
      }

      // Navigate to review with receipt ID
      navigate('/review', { state: { receiptIds: [receipt.id] } });
    } catch (err: any) {
      console.error('Processing error:', err);
      toast({
        title: 'Error processing receipt',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Scan your docket</h1>
        <p className="text-sm text-muted-foreground">
          Long receipt? Add multiple photos — we'll merge them automatically
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Uploaded images grid */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm">
                Photos of this docket
              </h2>
              <Badge variant="secondary" className="font-mono">
                {images.length} {images.length === 1 ? 'photo' : 'photos'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <Card key={img.id} className="relative overflow-hidden">
                  <CardContent className="p-1.5">
                    <div className="relative">
                      <img
                        src={img.preview}
                        alt={`Receipt section ${idx + 1}`}
                        className="w-full h-28 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                        disabled={processing}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Badge className="absolute bottom-1 left-1 text-[10px]" variant="secondary">
                        {idx + 1}/{images.length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add image options */}
        {!processing && (
          <div className="space-y-3">
            {images.length > 0 && (
              <h2 className="font-display font-semibold text-sm text-muted-foreground">
                Add more sections of the receipt
              </h2>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer border-dashed border-2 hover:border-primary/50 transition-colors"
                onClick={() => cameraInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center gap-2 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-display text-sm font-semibold text-center">Take photo</p>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer border-dashed border-2 hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center gap-2 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10">
                    <Upload className="h-6 w-6 text-secondary" />
                  </div>
                  <p className="font-display text-sm font-semibold text-center">Upload file</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tips */}
        {images.length === 0 && (
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">📸 Tips for long receipts:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Photo each section with some overlap between shots</li>
              <li>• We'll automatically merge and remove duplicates</li>
              <li>• Include the store header and the total at the bottom</li>
              <li>• Lay the receipt flat and avoid shadows</li>
            </ul>
          </div>
        )}

        {/* Processing state */}
        {processing && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-display font-semibold">Reading your receipt…</p>
                <p className="text-sm text-muted-foreground">
                  AI is merging {images.length} {images.length === 1 ? 'photo' : 'photos'} and extracting items
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proceed button */}
        {images.length > 0 && !processing && (
          <Button className="w-full font-semibold" size="lg" onClick={handleProceed}>
            <FileText className="mr-2 h-4 w-4" />
            Process receipt ({images.length} {images.length === 1 ? 'photo' : 'photos'})
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </AppLayout>
  );
};

export default Scan;
