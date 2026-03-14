import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera, Upload, FileText, X, ArrowRight, Loader2, Trash2, Plus, ShoppingCart, Check, AlertTriangle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';
import { preprocessReceiptImage } from '@/lib/receiptPreprocess';

interface ScannedImage {
  id: string;
  file: File;
  preview: string;
}

interface DocketDraft {
  id: string;
  images: ScannedImage[];
}

interface PendingReceipt {
  id: string;
  store_name: string | null;
  created_at: string;
  status: string;
}

const Scan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scansRemaining, scanLimit, scansUsed, isPremium, loading: subLoading } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Multi-docket queue
  const [dockets, setDockets] = useState<DocketDraft[]>([
    { id: crypto.randomUUID(), images: [] },
  ]);
  const [activeDocketIdx, setActiveDocketIdx] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);

  // Load pending/unconfirmed receipts
  useState(() => {
    if (!user) return;
    supabase
      .from('receipts')
      .select('id, store_name, created_at, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPendingReceipts(data);
      });
  });

  const activeDocket = dockets[activeDocketIdx];
  const totalImages = dockets.reduce((s, d) => s + d.images.length, 0);
  const docketsWithImages = dockets.filter((d) => d.images.length > 0);

  const deletePendingReceipt = async (receiptId: string) => {
    try {
      await supabase.from('receipt_items').delete().eq('receipt_id', receiptId);
      await supabase.from('receipts').delete().eq('id', receiptId);
      setPendingReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      toast({ title: 'Docket deleted' });
    } catch (err) {
      toast({ title: 'Error deleting docket', variant: 'destructive' });
    }
  };

  const [preprocessingImage, setPreprocessingImage] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setPreprocessingImage(true);

    try {
      const result = await preprocessReceiptImage(file);

      if (!result.quality.ok) {
        toast({
          title: 'Photo quality issue',
          description: result.quality.message || 'Please retake the receipt photo with the full receipt visible in good lighting.',
          variant: 'destructive',
          duration: 6000,
        });
        setPreprocessingImage(false);
        return;
      }

      setDockets((prev) =>
        prev.map((d, i) =>
          i === activeDocketIdx
            ? { ...d, images: [...d.images, { id: crypto.randomUUID(), file: result.file, preview: result.preview }] }
            : d
        )
      );
    } catch (err) {
      console.error('Preprocessing error:', err);
      // Fallback: use original image
      const reader = new FileReader();
      reader.onloadend = () => {
        setDockets((prev) =>
          prev.map((d, i) =>
            i === activeDocketIdx
              ? { ...d, images: [...d.images, { id: crypto.randomUUID(), file, preview: reader.result as string }] }
              : d
          )
        );
      };
      reader.readAsDataURL(file);
    } finally {
      setPreprocessingImage(false);
    }
  };

  const removeImage = (imageId: string) => {
    setDockets((prev) =>
      prev.map((d, i) =>
        i === activeDocketIdx
          ? { ...d, images: d.images.filter((img) => img.id !== imageId) }
          : d
      )
    );
  };

  const addDocket = () => {
    const newDocket: DocketDraft = { id: crypto.randomUUID(), images: [] };
    setDockets((prev) => [...prev, newDocket]);
    setActiveDocketIdx(dockets.length);
  };

  const removeDocket = (idx: number) => {
    if (dockets.length <= 1) return;
    setDockets((prev) => prev.filter((_, i) => i !== idx));
    if (activeDocketIdx >= idx && activeDocketIdx > 0) {
      setActiveDocketIdx(activeDocketIdx - 1);
    }
  };

  const processAllDockets = async () => {
    if (!user || docketsWithImages.length === 0) return;

    // Check scan limit for free users
    if (!isPremium && scansRemaining < docketsWithImages.length) {
      toast({
        title: 'Weekly scan limit reached',
        description: `Free plan allows ${scanLimit} scans per week. You have ${scansRemaining} remaining. Upgrade to Premium for unlimited scans.`,
        variant: 'destructive',
      });
      return;
    }

    // Increment scan counter for each docket
    if (!isPremium) {
      for (let i = 0; i < docketsWithImages.length; i++) {
        const { data } = await supabase.rpc('check_and_increment_scan');
        const d = data as any;
        if (!d?.allowed) {
          toast({
            title: 'Scan limit reached',
            description: 'Upgrade to Premium for unlimited scans.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setProcessing(true);

    const receiptIds: string[] = [];
    let needsReviewCount = 0;

    try {
      setProcessingProgress({ current: 0, total: docketsWithImages.length });

      for (let dIdx = 0; dIdx < docketsWithImages.length; dIdx++) {
        const docket = docketsWithImages[dIdx];
        setProcessingProgress({ current: dIdx + 1, total: docketsWithImages.length });

        // 1. Create receipt record
        const { data: receipt, error: receiptError } = await supabase
          .from('receipts')
          .insert({ user_id: user.id, status: 'pending' })
          .select('id')
          .single();

        if (receiptError || !receipt) {
          throw new Error(`Failed to create receipt ${dIdx + 1}`);
        }

        receiptIds.push(receipt.id);

        // 2. Upload images
        const imagePaths: string[] = [];
        for (let i = 0; i < docket.images.length; i++) {
          const img = docket.images[i];
          const ext = img.file.name.split('.').pop() || 'jpg';
          const storagePath = `${user.id}/${receipt.id}_${i + 1}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(storagePath, img.file);

          if (uploadError) {
            throw new Error(`Failed to upload image ${i + 1} of docket ${dIdx + 1}`);
          }
          imagePaths.push(storagePath);
        }

        // 3. Update receipt with image paths
        await supabase
          .from('receipts')
          .update({ image_url: imagePaths[0], image_paths: imagePaths } as any)
          .eq('id', receipt.id);

        // 4. Call OCR (with server-side quality gate)
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
          'process-receipt',
          { body: { receipt_id: receipt.id, image_paths: imagePaths } }
        );

        if (ocrError) {
          console.error(`OCR error for docket ${dIdx + 1}:`, ocrError);
        }

        // Check if server rejected image quality
        if (ocrData?.rejected) {
          toast({
            title: 'Photo quality issue',
            description: ocrData.message || 'Please retake the receipt photo with the full receipt visible in good lighting.',
            variant: 'destructive',
            duration: 8000,
          });
          // Clean up the rejected receipt
          await supabase.from('receipts').delete().eq('id', receipt.id);
          receiptIds.pop();
          continue;
        }

        // Track if any receipt needs review
        if (ocrData?.needs_review) {
          needsReviewCount++;
        }
      }

      if (receiptIds.length === 0) {
        toast({ title: 'No receipts processed', variant: 'destructive' });
        return;
      }

      // Route based on confidence: skip review for high-confidence scans
      if (needsReviewCount === 0) {
        // All scans high confidence — auto-confirm and go to analysis
        for (const id of receiptIds) {
          await supabase
            .from('receipts')
            .update({ status: 'confirmed' })
            .eq('id', id);
        }
        toast({ title: `${receiptIds.length === 1 ? 'Receipt' : `${receiptIds.length} receipts`} confirmed automatically`, description: 'High confidence scan — no review needed.' });
        navigate('/analysis', { state: { receiptIds } });
      } else {
        // Some scans need review
        navigate('/review', { state: { receiptIds } });
      }
    } catch (err: any) {
      console.error('Processing error:', err);
      toast({
        title: 'Error processing receipts',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
      // If some succeeded, still allow review
      if (receiptIds.length > 0) {
        navigate('/review', { state: { receiptIds } });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Just scan it</h1>
        <p className="text-sm text-muted-foreground">
          Snap your receipt — no planning needed, we'll figure out the rest
        </p>
        {!isPremium && !subLoading && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={scansRemaining > 0 ? 'secondary' : 'destructive'} className="text-xs">
              {scansRemaining}/{scanLimit} scans left this week
            </Badge>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* Docket tabs */}
        {!processing && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {dockets.map((docket, idx) => (
              <button
                key={docket.id}
                onClick={() => setActiveDocketIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 transition-colors ${
                  idx === activeDocketIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Docket {idx + 1}
                {docket.images.length > 0 && (
                  <Badge
                    variant={idx === activeDocketIdx ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0 ml-0.5"
                  >
                    {docket.images.length}
                  </Badge>
                )}
                {dockets.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDocket(idx);
                    }}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}
            <button
              onClick={addDocket}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add docket
            </button>
          </div>
        )}

        {/* Active docket images */}
        {!processing && activeDocket.images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm">
                Docket {activeDocketIdx + 1} photos
              </h2>
              <Badge variant="secondary" className="font-mono">
                {activeDocket.images.length} {activeDocket.images.length === 1 ? 'photo' : 'photos'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {activeDocket.images.map((img, idx) => (
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
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Badge className="absolute bottom-1 left-1 text-[10px]" variant="secondary">
                        {idx + 1}/{activeDocket.images.length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Preprocessing indicator */}
        {preprocessingImage && (
          <Card className="border-primary/30">
            <CardContent className="flex items-center gap-3 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Optimising image…</p>
                <p className="text-xs text-muted-foreground">Enhancing contrast, sharpening text, reducing shadows</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add image options */}
        {!processing && !preprocessingImage && (
          <div className="space-y-3">
            {activeDocket.images.length > 0 && (
              <h2 className="font-display font-semibold text-sm text-muted-foreground">
                Add more sections of this receipt
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

        {/* Pending / unconfirmed dockets */}
        {pendingReceipts.length > 0 && !processing && (
          <div className="space-y-2">
            <h2 className="font-display font-semibold text-sm text-muted-foreground">
              Pending dockets
            </h2>
            {pendingReceipts.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.store_name || 'Unknown Store'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()} · {r.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/review', { state: { receiptIds: [r.id] } })}
                    >
                      Review
                    </Button>
                    <button
                      onClick={() => deletePendingReceipt(r.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tips */}
        {totalImages === 0 && !processing && (
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">📸 Tips:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Long receipt? Add multiple photos per docket — we'll merge them</li>
              <li>• Multiple stores? Use "Add docket" to queue separate receipts</li>
              <li>• Include the store header and total at the bottom</li>
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
                <p className="font-display font-semibold">
                  Processing docket {processingProgress.current} of {processingProgress.total}…
                </p>
                <p className="text-sm text-muted-foreground">
                  AI is reading and extracting items from {totalImages} {totalImages === 1 ? 'photo' : 'photos'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Process all button */}
        {docketsWithImages.length > 0 && !processing && (
          <Button className="w-full font-semibold" size="lg" onClick={processAllDockets}>
            <FileText className="mr-2 h-4 w-4" />
            Process {docketsWithImages.length} {docketsWithImages.length === 1 ? 'docket' : 'dockets'}
            {' '}({totalImages} {totalImages === 1 ? 'photo' : 'photos'})
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
