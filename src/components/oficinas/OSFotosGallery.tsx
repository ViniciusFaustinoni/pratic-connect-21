import { useState, useMemo } from 'react';
import { Trash2, ZoomIn, Camera } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOSFotos, useDeleteOSFoto } from '@/hooks/useOSFotos';
import { OSFotoUpload } from './OSFotoUpload';
import type { TipoFotoOS, OrdemServicoFoto } from '@/types/database';

const TIPO_FOTO_LABELS: Record<TipoFotoOS, string> = {
  entrada: 'Entrada',
  execucao: 'Execução',
  conclusao: 'Conclusão',
};

interface Props {
  osId: string;
  readonly?: boolean;
}

export function OSFotosGallery({ osId, readonly = false }: Props) {
  const { data: fotos = [], isLoading } = useOSFotos(osId);
  const deleteFoto = useDeleteOSFoto();

  const [selectedTab, setSelectedTab] = useState<TipoFotoOS>('entrada');
  const [lightboxFoto, setLightboxFoto] = useState<OrdemServicoFoto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OrdemServicoFoto | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fotosByTipo = useMemo(() => {
    return {
      entrada: fotos.filter((f) => f.tipo === 'entrada'),
      execucao: fotos.filter((f) => f.tipo === 'execucao'),
      conclusao: fotos.filter((f) => f.tipo === 'conclusao'),
    };
  }, [fotos]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteFoto.mutateAsync({
      id: deleteConfirm.id,
      ordem_servico_id: deleteConfirm.ordem_servico_id,
      arquivo_url: deleteConfirm.arquivo_url,
    });
    setDeleteConfirm(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as TipoFotoOS)}>
        <div className="flex items-center justify-between">
          <TabsList>
            {Object.entries(TIPO_FOTO_LABELS).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label} ({fotosByTipo[value as TipoFotoOS].length})
              </TabsTrigger>
            ))}
          </TabsList>
          {!readonly && (
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
              <Camera className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>

        {Object.entries(TIPO_FOTO_LABELS).map(([tipo, label]) => (
          <TabsContent key={tipo} value={tipo} className="mt-4">
            {fotosByTipo[tipo as TipoFotoOS].length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  Nenhuma foto de {label.toLowerCase()}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {fotosByTipo[tipo as TipoFotoOS].map((foto) => (
                  <div
                    key={foto.id}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-muted"
                    onClick={() => setLightboxFoto(foto)}
                  >
                    <img
                      src={foto.arquivo_url}
                      alt={foto.descricao || `Foto ${foto.tipo}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <ZoomIn className="h-6 w-6 text-white" />
                    </div>
                    {!readonly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(foto);
                        }}
                        className="absolute right-1 top-1 rounded-full bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Lightbox */}
      <Dialog open={!!lightboxFoto} onOpenChange={() => setLightboxFoto(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">Visualizar foto</DialogTitle>
          {lightboxFoto && (
            <img
              src={lightboxFoto.arquivo_url}
              alt={lightboxFoto.descricao || 'Foto'}
              className="h-auto max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Modal */}
      <OSFotoUpload
        osId={osId}
        defaultTipo={selectedTab}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  );
}
