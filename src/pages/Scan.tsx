import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, FileText, Image } from 'lucide-react';

const Scan = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    // TODO: Upload to storage, trigger OCR, navigate to review
    navigate('/review');
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Scan receipt</h1>
        <p className="text-sm text-muted-foreground">Upload or photograph your grocery docket</p>
      </div>

      <div className="px-4 space-y-4">
        {!preview ? (
          <>
            {/* Camera option */}
            <Card
              className="cursor-pointer border-dashed border-2 hover:border-primary/50 transition-colors"
              onClick={() => cameraInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center gap-3 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Camera className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-display font-semibold">Take a photo</p>
                  <p className="text-sm text-muted-foreground">Use your camera to snap the receipt</p>
                </div>
              </CardContent>
            </Card>

            {/* Upload option */}
            <Card
              className="cursor-pointer border-dashed border-2 hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center gap-3 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10">
                  <Upload className="h-7 w-7 text-secondary" />
                </div>
                <div className="text-center">
                  <p className="font-display font-semibold">Upload a photo or PDF</p>
                  <p className="text-sm text-muted-foreground">Select from your files</p>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <div className="rounded-xl bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">📸 Tips for best results:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Lay the receipt flat on a contrasting surface</li>
                <li>• Make sure all text is in focus</li>
                <li>• Include the full receipt from store name to total</li>
                <li>• Avoid shadows across the text</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <Card>
              <CardContent className="p-4">
                <div className="relative overflow-hidden rounded-lg">
                  <img src={preview} alt="Receipt preview" className="w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                }}
              >
                Retake
              </Button>
              <Button className="flex-1 font-semibold" onClick={handleUpload}>
                <FileText className="mr-2 h-4 w-4" />
                Process receipt
              </Button>
            </div>
          </>
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
