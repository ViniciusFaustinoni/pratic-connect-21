import { useState } from 'react';
import { Plus, Trash2, Building2, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  useAssociacoesConcorrentes,
  useCriarAssociacaoConcorrente,
  useAtualizarAssociacaoConcorrente,
  useDeletarAssociacaoConcorrente,
  type AssociacaoConcorrente,
} from '@/hooks/useIndiciosConcorrencia';
import { toast } from 'sonner';

interface CadastroAssociacoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CadastroAssociacoesModal({ open, onOpenChange }: CadastroAssociacoesModalProps) {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<AssociacaoConcorrente | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [palavrasChave, setPalavrasChave] = useState('');
  const [dominiosEmail, setDominiosEmail] = useState('');
  const [ativo, setAtivo] = useState(true);

  const { data: concorrentes = [], isLoading, refetch } = useAssociacoesConcorrentes(false);
  const criarMutation = useCriarAssociacaoConcorrente();
  const atualizarMutation = useAtualizarAssociacaoConcorrente();
  const deletarMutation = useDeletarAssociacaoConcorrente();

  const resetForm = () => {
    setNome('');
    setCnpj('');
    setPalavrasChave('');
    setDominiosEmail('');
    setAtivo(true);
    setEditando(null);
    setShowForm(false);
  };

  const handleEdit = (concorrente: AssociacaoConcorrente) => {
    setEditando(concorrente);
    setNome(concorrente.nome);
    setCnpj(concorrente.cnpj || '');
    setPalavrasChave(concorrente.palavras_chave?.join(', ') || '');
    setDominiosEmail(concorrente.dominios_email?.join(', ') || '');
    setAtivo(concorrente.ativo);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const data = {
      nome: nome.trim(),
      cnpj: cnpj.trim() || null,
      palavras_chave: palavrasChave
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
      dominios_email: dominiosEmail
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
      ativo,
    };

    try {
      if (editando) {
        await atualizarMutation.mutateAsync({ id: editando.id, data });
        toast.success('Concorrente atualizado!');
      } else {
        await criarMutation.mutateAsync(data);
        toast.success('Concorrente cadastrado!');
      }
      resetForm();
      refetch();
    } catch (error) {
      toast.error('Erro ao salvar concorrente');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletarMutation.mutateAsync(id);
      toast.success('Concorrente removido!');
      setDeleteConfirm(null);
      refetch();
    } catch (error) {
      toast.error('Erro ao remover concorrente');
    }
  };

  const handleToggleAtivo = async (concorrente: AssociacaoConcorrente) => {
    try {
      await atualizarMutation.mutateAsync({
        id: concorrente.id,
        data: { ativo: !concorrente.ativo },
      });
      toast.success(concorrente.ativo ? 'Concorrente desativado' : 'Concorrente ativado');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gerenciar Associações Concorrentes
            </DialogTitle>
            <DialogDescription>
              Cadastre associações concorrentes para detectar possíveis conflitos de interesse.
            </DialogDescription>
          </DialogHeader>

          {showForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nome">Nome da Associação *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Associação XYZ"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="ativo"
                    checked={ativo}
                    onCheckedChange={setAtivo}
                  />
                  <Label htmlFor="ativo">Ativo</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="palavras">Palavras-chave (separadas por vírgula)</Label>
                <Input
                  id="palavras"
                  value={palavrasChave}
                  onChange={(e) => setPalavrasChave(e.target.value)}
                  placeholder="Ex: proteja, associacao xyz, apv"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Palavras que serão buscadas nas observações dos leads
                </p>
              </div>

              <div>
                <Label htmlFor="dominios">Domínios de Email (separados por vírgula)</Label>
                <Input
                  id="dominios"
                  value={dominiosEmail}
                  onChange={(e) => setDominiosEmail(e.target.value)}
                  placeholder="Ex: associacaoxyz.com.br, proteja.com"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Domínios de email que indicam vínculo com a concorrente
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={criarMutation.isPending || atualizarMutation.isPending}
                >
                  {editando ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Associação
                </Button>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : concorrentes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">Nenhuma associação cadastrada</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cadastre associações concorrentes para monitoramento
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {concorrentes.map((conc) => (
                      <div
                        key={conc.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          conc.ativo ? 'bg-card' : 'bg-muted/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{conc.nome}</h4>
                              {!conc.ativo && (
                                <Badge variant="secondary" className="text-xs">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            {conc.cnpj && (
                              <p className="text-sm text-muted-foreground">CNPJ: {conc.cnpj}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {conc.palavras_chave?.slice(0, 3).map((palavra, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {palavra}
                                </Badge>
                              ))}
                              {(conc.palavras_chave?.length || 0) > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(conc.palavras_chave?.length || 0) - 3}
                                </Badge>
                              )}
                            </div>
                            {conc.dominios_email && conc.dominios_email.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Domínios: {conc.dominios_email.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={conc.ativo}
                              onCheckedChange={() => handleToggleAtivo(conc)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(conc)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(conc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta associação concorrente? Esta ação não pode ser
              desfeita e os indícios relacionados perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
