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

interface ScannedDocket {
  id: string;
  file: File;
  preview: string;
}

const Scan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dockets, setDockets] = useState<ScannedDocket[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDockets((prev) => [
        ...prev,
        { id: crypto.randomUUID(), file, preview: reader.result as string },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeDocket = (id: string) => {
    setDockets((prev) => prev.filter((d) => d.id !== id));
  };

  const handleProceed = async () => {
    if (!user || dockets.length === 0) return;
    setProcessing(true);

    try {
      const receiptIds: string[] = [];

      for (const docket of dockets) {
        // 1. Create receipt record
        const { data: receipt, error: receiptError } = await supabase
          .from('receipts')
          .insert({ user_id: user.id, status: 'pending' })
          .select('id')
          .single();

        if (receiptError || !receipt) {
          throw new Error('Failed to create receipt record');
        }

        // 2. Upload image to storage
        const ext = docket.file.name.split('.').pop() || 'jpg';
        const storagePath = `${user.id}/${receipt.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(storagePath, docket.file);

        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        // 3. Update receipt with image path
        await supabase
          .from('receipts')
          .update({ image_url: storagePath })
          .eq('id', receipt.id);

        // 4. Call OCR edge function
        const { data: ocrResult, error: ocrError } = await supabase.functions.invoke(
          'process-receipt',
          { body: { receipt_id: receipt.id } }
        );

        if (ocrError) {
          console.error('OCR error:', ocrError);
          toast({
            title: 'OCR warning',
            description: `Docket ${receiptIds.length + 1} may need manual review`,
            variant: 'destructive',
          });
        }

        receiptIds.push(receipt.id);
      }

      // Navigate to review with all receipt IDs
      navigate('/review', { state: { receiptIds } });
    } catch (err: any) {
      console.error('Processing error:', err);
      toast({
        title: 'Error processing receipts',
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
        <h1 className="font-display text-2xl font-bold">Scan receipts</h1>
        <p className="text-sm text-muted-foreground">
          Add all dockets from this shopping trip
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Scanned dockets grid */}
        {dockets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm">Dockets added</h2>
              <Badge variant="secondary" className="font-mono">{dockets.length}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {dockets.map((docket, idx) => (
                <Card key={docket.id} className="relative overflow-hidden">
                  <CardContent className="p-2">
                    <div className="relative">
                      <img
                        src={docket.preview}
                        alt={`Receipt ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeDocket(docket.id)}
                        className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                        disabled={processing}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Badge className="absolute bottom-1 left-1 text-xs" variant="secondary">
                        #{idx + 1}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add docket options */}
        {!processing && (
          <div className="space-y-3">
            {dockets.length > 0 && (
              <h2 className="font-display font-semibold text-sm text-muted-foreground">
                Add another docket
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
        {dockets.length === 0 && (
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">📸 Tips for best results:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Lay the receipt flat on a contrasting surface</li>
              <li>• Make sure all text is in focus</li>
              <li>• Include the full receipt from store name to total</li>
              <li>• Avoid shadows across the text</li>
            </ul>
          </div>
        )}

        {/* Processing state */}
        {processing && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-display font-semibold">Processing dockets…</p>
                <p className="text-sm text-muted-foreground">
                  AI is reading your receipts. This may take a moment.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proceed button */}
        {dockets.length > 0 && !processing && (
          <Button className="w-full font-semibold" size="lg" onClick={handleProceed}>
            <FileText className="mr-2 h-4 w-4" />
            Process {dockets.length} {dockets.length === 1 ? 'docket' : 'dockets'}
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
