import { useState } from 'react';
import { MapPin, Phone, Mail, Pencil, Trash2, Plus, Package } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AutoCenterFormDialog } from './AutoCenterFormDialog';
import { AutoCenterPecaFormDialog } from './AutoCenterPecaFormDialog';
import { AutoCenterHistorico } from './AutoCenterHistorico';
import {
  useAutoCenterPecas, useDeleteAutoCenter, useDeletePeca, type AutoCenter,
} from '@/hooks/useAutoCenters';

const TIPO_LABELS: Record<string, string> = {
  auto_center: 'Auto Center',
  ferro_velho: 'Ferro Velho',
};

interface Props {
  autoCenter: AutoCenter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoCenterDetailDrawer({ autoCenter, open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [pecaFormOpen, setPecaFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteAutoCenter = useDeleteAutoCenter();
  const deletePeca = useDeletePeca();
  const { data: pecas, isLoading: loadingPecas } = useAutoCenterPecas(autoCenter?.id);

  if (!autoCenter) return null;

  const handleDelete = async () => {
    await deleteAutoCenter.mutateAsync(autoCenter.id);
    setDeleteConfirmOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle>{autoCenter.nome}</SheetTitle>
              </div>
              <Badge>{TIPO_LABELS[autoCenter.tipo] || autoCenter.tipo}</Badge>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Contato */}
            {(autoCenter.contato_nome || autoCenter.contato_telefone || autoCenter.contato_email) && (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Phone className="h-4 w-4" /> Contato
                  </h3>
                  <div className="space-y-2 text-sm">
                    {autoCenter.contato_nome && <p>{autoCenter.contato_nome}</p>}
                    {autoCenter.contato_telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{autoCenter.contato_telefone}</span>
                      </div>
                    )}
                    {autoCenter.contato_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{autoCenter.contato_email}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Endereço */}
            {(autoCenter.endereco || autoCenter.cidade) && (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" /> Endereço
                  </h3>
                  <div className="space-y-1 text-sm">
                    {autoCenter.endereco && <p>{autoCenter.endereco}</p>}
                    <p>
                      {autoCenter.cidade}{autoCenter.estado ? ` - ${autoCenter.estado}` : ''}
                      {autoCenter.cep ? ` | CEP: ${autoCenter.cep}` : ''}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Observações */}
            {autoCenter.observacoes && (
              <>
                <div className="space-y-2">
                  <h3 className="font-medium">Observações</h3>
                  <p className="text-sm text-muted-foreground">{autoCenter.observacoes}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Marcas Atendidas */}
            {autoCenter.marcas_atendidas && autoCenter.marcas_atendidas.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium">Marcas Atendidas</h3>
                  <div className="flex flex-wrap gap-1">
                    {autoCenter.marcas_atendidas.includes('GLOBAL') ? (
                      <Badge className="bg-primary text-primary-foreground">GLOBAL</Badge>
                    ) : (
                      autoCenter.marcas_atendidas.map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                      ))
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Tipos de Peças */}
            {autoCenter.especialidades && autoCenter.especialidades.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium">Tipos de Peças</h3>
                  <div className="flex flex-wrap gap-2">
                    {autoCenter.especialidades.map((e) => (
                      <Badge key={e} variant="outline">{e}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Peças */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium">
                  <Package className="h-4 w-4" /> Peças
                </h3>
                <Button size="sm" variant="outline" onClick={() => setPecaFormOpen(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar
                </Button>
              </div>

              {loadingPecas ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : pecas?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma peça cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {pecas?.map((peca) => (
                    <div key={peca.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{peca.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {peca.valor != null && (
                            <span className="text-sm text-muted-foreground">
                              R$ {Number(peca.valor).toFixed(2)}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {peca.condicao === 'novo' ? 'Novo' : 'Usado'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deletePeca.mutate({ id: peca.id, autoCenterId: autoCenter.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Histórico de Orçamentos */}
            <AutoCenterHistorico autoCenterId={autoCenter.id} />

            <Separator />

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AutoCenterFormDialog open={editOpen} onOpenChange={setEditOpen} autoCenter={autoCenter} />
      <AutoCenterPecaFormDialog
        open={pecaFormOpen}
        onOpenChange={setPecaFormOpen}
        autoCenterId={autoCenter.id}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Auto Center?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá o auto center e todas as suas peças. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
