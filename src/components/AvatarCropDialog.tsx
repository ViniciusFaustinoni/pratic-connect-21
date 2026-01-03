import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, ZoomIn } from 'lucide-react';
import { getCroppedImg, CropArea } from '@/lib/cropImage';

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

export function AvatarCropDialog({
  open,
  imageSrc,
  onClose,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onClose();
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recortar Foto</DialogTitle>
          <DialogDescription>
            Ajuste a posição e o zoom para recortar sua foto de perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop Area */}
          <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={setZoom}
            />
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(values) => setZoom(values[0])}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm text-muted-foreground">
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {processing ? 'Processando...' : 'Confirmar e Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
