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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { AlertCircle, ArrowDown, Loader2, Network, RefreshCw, UserRound, Users2 } from 'lucide-react';
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

function ChainNode({ label, name, icon: Icon, loading = false }: { label: string; name: string; icon: typeof UserRound; loading?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background border">
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{name}</div>
      </div>
    </div>
  );
}

export function EditarHierarquiaModal({ open, onOpenChange, linha, atribuicoes }: EditarHierarquiaModalProps) {
  const {
    data: usuarios = [],
    isLoading: loadingUsuarios,
    isFetching: fetchingUsuarios,
    isError: erroUsuarios,
    error: usuariosError,
    refetch: refetchUsuarios,
  } = useUsuariosVendas();
  const upsertHierarquia = useUpsertHierarquia();

  const [supervisorId, setSupervisorId] = useState<string>('none');
  const [gerenteId, setGerenteId] = useState<string>('none');
  const [observacoes, setObservacoes] = useState<string>('');

  useEffect(() => {
    if (!open || !linha) return;
    setSupervisorId(linha.hierarquia?.supervisor_id || 'none');
    setGerenteId(linha.hierarquia?.gerente_id || 'none');
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

  const subordinados = (atribuicoes || []).filter((item) => {
    const h = item.hierarquia;
    return h?.supervisor_id === selectedUserId || h?.gerente_id === selectedUserId;
  });

  const subordinadosDiretos = subordinados.filter((item) => item.hierarquia?.supervisor_id === selectedUserId);
  const subordinadosGerenciais = subordinados.filter((item) => item.hierarquia?.gerente_id === selectedUserId);
  const atribuicaoPorUsuario = new Map(atribuicoes.map((item) => [item.usuario.id, item]));
  const supervisorSelecionado = supervisorId === 'none' ? null : supervisorId;
  // Gerente herdado do supervisor (quando o supervisor já tem gerente atribuído na hierarquia dele)
  const gerenteHerdadoDoSupervisor = supervisorSelecionado
    ? atribuicaoPorUsuario.get(supervisorSelecionado)?.hierarquia?.gerente_id ?? null
    : null;
  const gerenteEffectiveId = gerenteHerdadoDoSupervisor ?? (gerenteId === 'none' ? null : gerenteId);
  const gerenteSelecionado = gerenteEffectiveId;
  const gerenteBloqueado = !!gerenteHerdadoDoSupervisor;
  const supervisorPertenceAoGerente = (supervisorUserId: string, gerenteUserId: string) => {
    const supervisorHierarquiaAtual = atribuicaoPorUsuario.get(supervisorUserId)?.hierarquia;
    return !supervisorHierarquiaAtual?.gerente_id || supervisorHierarquiaAtual.gerente_id === gerenteUserId;
  };
  const supervisoresCompativeis = gerenteSelecionado && !gerenteBloqueado
    ? supervisores.filter((u) => supervisorPertenceAoGerente(u.id, gerenteSelecionado))
    : supervisores;
  const gerenteOptions = [
    { value: 'none', label: 'Nenhum gerente' },
    ...gerentes.map((u) => ({ value: u.id, label: `${u.nome} · ${u.email}` })),
  ];
  const supervisorOptions = [
    { value: 'none', label: 'Nenhum supervisor' },
    ...supervisoresCompativeis.map((u) => ({ value: u.id, label: `${u.nome} · ${u.email}` })),
  ];

  const validationErrors: string[] = [];
  const supervisorHierarquia = supervisorSelecionado ? atribuicaoPorUsuario.get(supervisorSelecionado)?.hierarquia : null;

  if (gerenteSelecionado && supervisorSelecionado && supervisorHierarquia?.gerente_id && supervisorHierarquia.gerente_id !== gerenteSelecionado) {
    validationErrors.push('O supervisor selecionado já pertence a outro gerente. Escolha um supervisor vinculado ao gerente informado.');
  }

  const hasValidationErrors = validationErrors.length > 0;
  const relacaoSubordinado = (item: AtribuicaoLinha) => {
    const relacoes: string[] = [];
    if (item.hierarquia?.gerente_id === selectedUserId) relacoes.push('Gerente');
    if (item.hierarquia?.supervisor_id === selectedUserId) relacoes.push('Supervisor');
    return relacoes.join(' / ') || 'Vínculo';
  };

  const handleGerenteChange = (nextGerenteId: string) => {
    setGerenteId(nextGerenteId);

    if (nextGerenteId !== 'none' && supervisorId !== 'none' && !supervisorPertenceAoGerente(supervisorId, nextGerenteId)) {
      setSupervisorId('none');
      toast.info('Supervisor removido para manter a cadeia Gerente → Supervisor → Usuário.');
    }
  };

  const handleSupervisorChange = (nextSupervisorId: string) => {
    if (nextSupervisorId === 'none') {
      setSupervisorId('none');
      return;
    }

    const supervisorHierarquiaAtual = atribuicaoPorUsuario.get(nextSupervisorId)?.hierarquia;
    if (gerenteId !== 'none' && supervisorHierarquiaAtual?.gerente_id && supervisorHierarquiaAtual.gerente_id !== gerenteId) {
      toast.error('Este supervisor pertence a outro gerente. Escolha um supervisor compatível.');
      return;
    }

    setSupervisorId(nextSupervisorId);
    if (gerenteId === 'none' && supervisorHierarquiaAtual?.gerente_id) {
      setGerenteId(supervisorHierarquiaAtual.gerente_id);
    }
  };

  const handleSave = async () => {
    if (hasValidationErrors) {
      toast.error(validationErrors[0]);
      return;
    }

    try {
      await upsertHierarquia.mutateAsync({
        vendedor_id: selectedUserId,
        supervisor_id: supervisorId === 'none' ? null : supervisorId,
        gerente_id: gerenteId === 'none' ? null : gerenteId,
        agencia_id: null,
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
  const loadingVinculos = loadingUsuarios || fetchingUsuarios;
  const hasUsuarios = usuarios.length > 0;
  const errorMessage = usuariosError instanceof Error ? usuariosError.message : 'Não foi possível carregar os vínculos existentes.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <DialogTitle>Configurar equipe e hierarquia</DialogTitle>
              <DialogDescription>
                Ajuste os vínculos superiores e acompanhe quem está conectado a {linha.usuario.nome}.
              </DialogDescription>
            </div>
            {loadingVinculos && (
              <Badge variant="secondary" className="w-fit gap-1.5 font-normal">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando vínculos
              </Badge>
            )}
            {erroUsuarios && (
              <Badge variant="destructive" className="w-fit gap-1.5 font-normal">
                <AlertCircle className="h-3.5 w-3.5" />
                Erro ao carregar
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="grid max-h-[72vh] gap-0 overflow-y-auto lg:grid-cols-[0.95fr_1.15fr]">
          <div className="space-y-4 border-b bg-muted/20 p-6 lg:border-b-0 lg:border-r">
            <div className="rounded-md border bg-background p-4 shadow-sm">
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

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Cadeia atual</div>
                <Badge variant="outline" className="font-normal">Prévia</Badge>
              </div>
              {erroUsuarios && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}
              {!loadingVinculos && !erroUsuarios && !hasUsuarios && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Nenhum usuário disponível para formar vínculos.
                </div>
              )}
              <ChainNode label="Gerente" name={userName(usuariosMap, gerenteId === 'none' ? null : gerenteId)} icon={UserRound} loading={loadingVinculos} />
              <div className="flex justify-center text-muted-foreground"><ArrowDown className="h-4 w-4" /></div>
              <ChainNode label="Supervisor" name={userName(usuariosMap, supervisorId === 'none' ? null : supervisorId)} icon={Users2} loading={loadingVinculos} />
              <div className="flex justify-center text-muted-foreground"><ArrowDown className="h-4 w-4" /></div>
              <ChainNode label="Usuário selecionado" name={linha.usuario.nome} icon={Network} />
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <div className="text-sm font-medium">Vínculos superiores</div>
              <p className="text-xs text-muted-foreground">Selecione apenas os vínculos que devem participar da cadeia comercial deste usuário.</p>
            </div>

            {erroUsuarios && (
              <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => refetchUsuarios()} disabled={loadingVinculos}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {!loadingVinculos && !erroUsuarios && !hasUsuarios && (
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhum usuário de vendas foi encontrado. Você ainda pode salvar sem vínculos superiores.
              </div>
            )}

            {hasValidationErrors && (
              <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Hierarquia inválida
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  {validationErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label>Gerente superior</Label>
                <SearchableSelect
                  value={gerenteId}
                  onValueChange={handleGerenteChange}
                  options={gerenteOptions}
                  placeholder="Buscar gerente por nome ou e-mail"
                  searchPlaceholder="Digite nome ou e-mail do gerente..."
                  disabled={saving || erroUsuarios}
                  loading={loadingVinculos}
                  className="h-11"
                />
                {!loadingVinculos && gerentes.length === 0 && <p className="text-xs text-muted-foreground">Nenhum gerente disponível.</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Supervisor superior</Label>
                <SearchableSelect
                  value={supervisorId}
                  onValueChange={handleSupervisorChange}
                  options={supervisorOptions}
                  placeholder="Buscar supervisor por nome ou e-mail"
                  searchPlaceholder="Digite nome ou e-mail do supervisor..."
                  disabled={saving || erroUsuarios || (!!gerenteSelecionado && supervisoresCompativeis.length === 0)}
                  loading={loadingVinculos}
                  className="h-11"
                />
                {!loadingVinculos && supervisores.length === 0 && <p className="text-xs text-muted-foreground">Nenhum supervisor disponível.</p>}
                {!loadingVinculos && !!gerenteSelecionado && supervisores.length > 0 && supervisoresCompativeis.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum supervisor compatível com o gerente selecionado.</p>
                )}
              </div>

            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas sobre a estrutura desta equipe"
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="rounded-md border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Equipe inferior vinculada</div>
                  <div className="text-xs text-muted-foreground">Usuários que dependem desta posição na hierarquia.</div>
                </div>
                <Badge variant="secondary" className="shrink-0">{subordinados.length}</Badge>
              </div>
              {loadingVinculos ? (
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando usuários e vínculos...
                </div>
              ) : erroUsuarios ? (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Não foi possível carregar a equipe inferior.
                </div>
              ) : subordinados.length === 0 ? (
                <div className="rounded-md bg-muted/40 px-3 py-4 text-sm text-muted-foreground">Nenhum usuário abaixo desta posição.</div>
              ) : (
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-md bg-muted/40 px-2 py-1">Diretos: {subordinadosDiretos.length}</div>
                    <div className="rounded-md bg-muted/40 px-2 py-1">Por gerência: {subordinadosGerenciais.length}</div>
                  </div>
                  {subordinados.map((item) => (
                    <div key={item.usuario.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{item.usuario.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.usuario.email}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-normal">{relacaoSubordinado(item)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loadingVinculos || erroUsuarios || hasValidationErrors}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar hierarquia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}