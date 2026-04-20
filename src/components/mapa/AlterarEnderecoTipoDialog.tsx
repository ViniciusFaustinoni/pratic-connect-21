import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, MapPin, User, Layers, Search } from 'lucide-react';
import { useVistoriadoresAtivos } from '@/hooks/useAtribuicaoManual';
import { useAlocacoesDiaHoje } from '@/hooks/useAlocacoesDiaHoje';
import { useBasesPratic } from '@/hooks/useBasesPratic';
import { useAlterarEnderecoTipo } from '@/hooks/useAlterarEnderecoTipo';
import { buscarCep } from '@/lib/cep';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  origem: 'rota' | 'base';
  servicoId?: string | null;
  agendamentoBaseId?: string | null;
  resumo?: { placa?: string | null; associadoNome?: string | null };
  // Estado inicial (opcional) — preenche o formulário com o que já existe
  initialEndereco?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  };
  initialProfissionalId?: string | null;
  initialOficinaId?: string | null;
  initialHorario?: string | null;
  onSuccess?(): void;
}

export function AlterarEnderecoTipoDialog({
  open,
  onOpenChange,
  origem,
  servicoId,
  agendamentoBaseId,
  resumo,
  initialEndereco,
  initialProfissionalId,
  initialOficinaId,
  initialHorario,
  onSuccess,
}: Props) {
  const [tipoNovo, setTipoNovo] = useState<'rota' | 'base'>(origem);

  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  const [profissionalId, setProfissionalId] = useState<string | null>(null);
  const [filtroTec, setFiltroTec] = useState('');

  const [oficinaId, setOficinaId] = useState<string | null>(null);
  const [horario, setHorario] = useState('');

  const { data: tecnicos, isLoading: loadingTecs } = useVistoriadoresAtivos();
  const { data: alocacoesHoje = {} } = useAlocacoesDiaHoje();
  const { data: bases } = useBasesPratic();
  const mutation = useAlterarEnderecoTipo();

  // Reset quando abre
  useEffect(() => {
    if (!open) return;
    setTipoNovo(origem);
    setCep(initialEndereco?.cep || '');
    setLogradouro(initialEndereco?.logradouro || '');
    setNumero(initialEndereco?.numero || '');
    setComplemento(initialEndereco?.complemento || '');
    setBairro(initialEndereco?.bairro || '');
    setCidade(initialEndereco?.cidade || '');
    setUf(initialEndereco?.uf || '');
    setProfissionalId(initialProfissionalId || null);
    setOficinaId(initialOficinaId || null);
    setHorario(initialHorario || '');
    setFiltroTec('');
  }, [open, origem, initialEndereco, initialProfissionalId, initialOficinaId, initialHorario]);

  const handleBuscarCep = async () => {
    if (!cep) return;
    setLoadingCep(true);
    try {
      const r = await buscarCep(cep);
      if (!r) {
        toast.error('CEP não encontrado');
        return;
      }
      if (r.logradouro) setLogradouro(r.logradouro);
      if (r.bairro) setBairro(r.bairro);
      if (r.cidade) setCidade(r.cidade);
      if (r.uf) setUf(r.uf);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSalvar = async () => {
    try {
      await mutation.mutateAsync({
        origem,
        servicoId,
        agendamentoBaseId,
        tipoNovo,
        endereco: tipoNovo === 'rota' ? {
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
        } : undefined,
        profissionalId,
        oficinaId: tipoNovo === 'base' ? oficinaId : null,
        horario: tipoNovo === 'base' ? horario : null,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      // toast já tratado
    }
  };

  const tecnicosFiltrados = (tecnicos || []).filter((t: any) =>
    !filtroTec || (t.nome || '').toLowerCase().includes(filtroTec.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alterar endereço, técnico ou tipo</DialogTitle>
          <DialogDescription>
            {resumo?.placa && <span className="font-mono font-semibold">{resumo.placa}</span>}
            {resumo?.placa && resumo?.associadoNome && ' · '}
            {resumo?.associadoNome && <span>{resumo.associadoNome}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {/* Tipo */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-primary" /> Tipo de agendamento
            </h3>
            <Tabs value={tipoNovo} onValueChange={(v) => setTipoNovo(v as 'rota' | 'base')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rota">Rota (técnico vai até o cliente)</TabsTrigger>
                <TabsTrigger value="base">Base (cliente vai à oficina)</TabsTrigger>
              </TabsList>
            </Tabs>
            {tipoNovo !== origem && (
              <p className="text-xs text-amber-600 mt-2">
                Atenção: ao salvar, esta tarefa será convertida de <strong>{origem}</strong> para <strong>{tipoNovo}</strong>.
              </p>
            )}
          </section>

          {/* Endereço (apenas se tipoNovo = rota) */}
          {tipoNovo === 'rota' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Endereço
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleBuscarCep} disabled={loadingCep}>
                      {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                  <Label className="text-xs">Logradouro</Label>
                  <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Número</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Complemento</Label>
                  <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
            </section>
          )}

          {/* Base (apenas se tipoNovo = base) */}
          {tipoNovo === 'base' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Base e horário
              </h3>
              <div>
                <Label className="text-xs">Oficina / Base</Label>
                <Select value={oficinaId || ''} onValueChange={(v) => setOficinaId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a base" />
                  </SelectTrigger>
                  <SelectContent>
                    {(bases || []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nome_fantasia || b.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
              </div>
            </section>
          )}

          {/* Técnico */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Técnico
            </h3>
            <div className="border rounded-md">
              <Command>
                <CommandInput
                  placeholder="Buscar técnico..."
                  value={filtroTec}
                  onValueChange={setFiltroTec}
                />
                <CommandList className="max-h-48">
                  {loadingTecs ? (
                    <div className="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>Nenhum técnico encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__nenhum__"
                          onSelect={() => setProfissionalId(null)}
                          className="flex items-center gap-2"
                        >
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            ∅
                          </div>
                          <span className="flex-1 text-sm italic text-muted-foreground">
                            Sem técnico (deixar para o painel)
                          </span>
                          {profissionalId === null && <Badge variant="secondary" className="text-[10px]">Selecionado</Badge>}
                        </CommandItem>
                        {tecnicosFiltrados.map((t: any) => {
                          const aloc = (alocacoesHoje as any)?.[t.id];
                          const tipoAloc = aloc?.tipo_alocacao as 'rota' | 'base' | undefined;
                          const iniciais = (t.nome || '?')
                            .split(' ')
                            .map((n: string) => n[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();
                          const selected = profissionalId === t.id;
                          return (
                            <CommandItem
                              key={t.id}
                              value={t.nome || t.id}
                              onSelect={() => setProfissionalId(t.id)}
                              className="flex items-center gap-2"
                            >
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
                                {t.avatar_url ? (
                                  <img src={t.avatar_url} alt={t.nome} className="h-full w-full object-cover" />
                                ) : iniciais}
                              </div>
                              <span className="flex-1 truncate text-sm">{t.nome}</span>
                              {tipoAloc === 'base' && (
                                <Badge variant="outline" className="text-[10px] h-4 bg-amber-50 text-amber-700 border-amber-200">Base</Badge>
                              )}
                              {tipoAloc === 'rota' && (
                                <Badge variant="outline" className="text-[10px] h-4 bg-blue-50 text-blue-700 border-blue-200">Rota</Badge>
                              )}
                              {selected && <Badge variant="secondary" className="text-[10px]">Selecionado</Badge>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
