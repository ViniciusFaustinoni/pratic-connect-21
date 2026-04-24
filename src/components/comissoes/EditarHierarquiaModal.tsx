import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowDown, Building2, Loader2, Network, UserRound, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpsertHierarquia, useUsuariosVendas } from '@/hooks/useAtribuicaoComissoes';
import type { AtribuicaoLinha, UsuarioVendas } from '@/types/atribuicaoComissao';

interface EditarHierarquiaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linha: AtribuicaoLinha | null;
  atribuicoes: AtribuicaoLinha[];
}

const initials = (nome: string) =>
  nome
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

const userName = (usuariosMap: Map<string, UsuarioVendas>, id?: string | null) =>
  id ? usuariosMap.get(id)?.nome || 'Usuário não localizado' : 'Não definido';

function ChainNode({ label, name, icon: Icon }: { label: string; name: string; icon: typeof UserRound }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{name}</div>
      </div>
    </div>
  );
}

export function EditarHierarquiaModal({ open, onOpenChange, linha, atribuicoes }: EditarHierarquiaModalProps) {
  const { data: usuarios = [] } = useUsuariosVendas();
  const upsertHierarquia = useUpsertHierarquia();

  const [supervisorId, setSupervisorId] = useState<string>('none');
  const [gerenteId, setGerenteId] = useState<string>('none');
  const [agenciaId, setAgenciaId] = useState<string>('none');
  const [observacoes, setObservacoes] = useState<string>('');

  useEffect(() => {
    if (!open || !linha) return;
    setSupervisorId(linha.hierarquia?.supervisor_id || 'none');
    setGerenteId(linha.hierarquia?.gerente_id || 'none');
    setAgenciaId(linha.hierarquia?.agencia_id || 'none');
    setObservacoes(linha.hierarquia?.observacoes || '');
  }, [open, linha]);

  const usuariosMap = useMemo(() => {
    const map = new Map<string, UsuarioVendas>();
    usuarios.forEach((u) => map.set(u.id, u));
    return map;
  }, [usuarios]);

  if (!linha) return null;

  const selectedUserId = linha.usuario.id;
  const superiores = usuarios.filter((u) => u.id !== selectedUserId);
  const supervisores = superiores.filter((u) => u.roles.includes('supervisor_vendas'));
  const gerentes = superiores.filter((u) => u.roles.includes('gerente_comercial'));
  const agencias = superiores.filter((u) => u.roles.includes('agencia'));

  const subordinados = atribuicoes.filter((item) => {
    const h = item.hierarquia;
    return h?.supervisor_id === selectedUserId || h?.gerente_id === selectedUserId || h?.agencia_id === selectedUserId;
  });

  const handleSave = async () => {
    try {
      await upsertHierarquia.mutateAsync({
        vendedor_id: selectedUserId,
        supervisor_id: supervisorId === 'none' ? null : supervisorId,
        gerente_id: gerenteId === 'none' ? null : gerenteId,
        agencia_id: agenciaId === 'none' ? null : agenciaId,
        observacoes: observacoes.trim() || null,
      });

      toast.success('Hierarquia salva');
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao salvar hierarquia');
    }
  };

  const saving = upsertHierarquia.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurar equipe e hierarquia</DialogTitle>
          <DialogDescription>
            Visualize a cadeia atual e ajuste os vínculos superiores e inferiores de {linha.usuario.nome}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-md border p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={linha.usuario.avatar_url || undefined} />
                  <AvatarFallback>{initials(linha.usuario.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-medium truncate">{linha.usuario.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">{linha.usuario.email}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <ChainNode label="Gerente" name={userName(usuariosMap, gerenteId === 'none' ? null : gerenteId)} icon={UserRound} />
              <div className="flex justify-center text-muted-foreground"><ArrowDown className="h-4 w-4" /></div>
              <ChainNode label="Supervisor" name={userName(usuariosMap, supervisorId === 'none' ? null : supervisorId)} icon={Users2} />
              <div className="flex justify-center text-muted-foreground"><ArrowDown className="h-4 w-4" /></div>
              <ChainNode label="Usuário selecionado" name={linha.usuario.nome} icon={Network} />
              {agenciaId !== 'none' && (
                <>
                  <div className="flex justify-center text-muted-foreground"><ArrowDown className="h-4 w-4" /></div>
                  <ChainNode label="Agência vinculada" name={userName(usuariosMap, agenciaId)} icon={Building2} />
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Gerente superior</Label>
                <Select value={gerenteId} onValueChange={setGerenteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum gerente</SelectItem>
                    {gerentes.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Supervisor superior</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum supervisor</SelectItem>
                    {supervisores.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Agência vinculada</Label>
                <Select value={agenciaId} onValueChange={setAgenciaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma agência</SelectItem>
                    {agencias.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas sobre a estrutura desta equipe"
                rows={3}
              />
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Equipe inferior vinculada</div>
                <Badge variant="secondary">{subordinados.length}</Badge>
              </div>
              {subordinados.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum usuário abaixo desta posição.</div>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {subordinados.map((item) => (
                    <div key={item.usuario.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                      <span className="text-sm truncate">{item.usuario.nome}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.usuario.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar hierarquia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}