import { useState } from 'react';
import { MapPin, Phone, Mail, CreditCard, Pencil, Trash2, Building2 } from 'lucide-react';
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
import { PrestadorFormDialog } from './PrestadorFormDialog';
import { useDeletePrestadorEvento, type PrestadorEvento } from '@/hooks/usePrestadoresEvento';

interface Props {
  prestador: PrestadorEvento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrestadorDetailDrawer({ prestador, open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeletePrestadorEvento();

  if (!prestador) return null;

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(prestador.id);
    setDeleteOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle>{prestador.nome_fantasia || prestador.razao_social}</SheetTitle>
                {prestador.cnpj && <p className="text-sm text-muted-foreground">{prestador.cnpj}</p>}
              </div>
              <Badge variant={prestador.status === 'ativo' ? 'default' : 'secondary'}>
                {prestador.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Contato */}
            {(prestador.telefone || prestador.whatsapp || prestador.email) && (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4" /> Contato</h3>
                  <div className="space-y-2 text-sm">
                    {prestador.telefone && <p><span className="text-muted-foreground">Telefone:</span> {prestador.telefone}</p>}
                    {prestador.whatsapp && <p><span className="text-muted-foreground">WhatsApp:</span> {prestador.whatsapp}</p>}
                    {prestador.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{prestador.email}</span></div>}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Endereço */}
            {(prestador.logradouro || prestador.cidade) && (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" /> Endereço</h3>
                  <div className="space-y-1 text-sm">
                    {prestador.logradouro && <p>{prestador.logradouro}{prestador.numero && `, ${prestador.numero}`}{prestador.complemento && ` - ${prestador.complemento}`}</p>}
                    {prestador.bairro && <p>{prestador.bairro}</p>}
                    <p>{prestador.cidade}{prestador.estado ? ` - ${prestador.estado}` : ''}{prestador.cep ? ` | CEP: ${prestador.cep}` : ''}</p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Dados Bancários */}
            {(prestador.banco || prestador.pix_chave) && (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" /> Dados Bancários</h3>
                  <div className="space-y-2 text-sm">
                    {prestador.banco && <p><span className="text-muted-foreground">Banco:</span> {prestador.banco}</p>}
                    {prestador.agencia && <p><span className="text-muted-foreground">Agência:</span> {prestador.agencia}</p>}
                    {prestador.conta && <p><span className="text-muted-foreground">Conta:</span> {prestador.conta}</p>}
                    {prestador.pix_chave && <p><span className="text-muted-foreground">PIX ({prestador.pix_tipo}):</span> {prestador.pix_chave}</p>}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Marcas */}
            {prestador.marcas_atendidas?.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium">Marcas Atendidas</h3>
                  <div className="flex flex-wrap gap-1">
                    {prestador.marcas_atendidas.includes('GLOBAL') ? (
                      <Badge className="bg-primary text-primary-foreground">GLOBAL</Badge>
                    ) : (
                      prestador.marcas_atendidas.map(m => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Especialidades */}
            {prestador.especialidades?.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" /> Especialidades</h3>
                  <div className="flex flex-wrap gap-2">
                    {prestador.especialidades.map(e => <Badge key={e} variant="outline">{e}</Badge>)}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {prestador.observacoes && (
              <>
                <div className="space-y-2">
                  <h3 className="font-medium">Observações</h3>
                  <p className="text-sm text-muted-foreground">{prestador.observacoes}</p>
                </div>
                <Separator />
              </>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <PrestadorFormDialog open={editOpen} onOpenChange={setEditOpen} prestador={prestador} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Prestador?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
