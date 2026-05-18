import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { MapPinned, Building2, Route as RouteIcon, Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBasesPratic } from '@/hooks/useBasesPratic';
import { useInstaladores } from '@/hooks/useRotas';
import { useRealocarInstalacao } from '@/hooks/useRealocarInstalacao';
import { useConfigAtribuicaoManual } from '@/hooks/useAtribuicaoManual';
import { Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instalacaoId: string;
  veiculoLabel?: string;
  associadoNome?: string;
  onSuccess?: () => void;
}

export function RealocarInstalacaoDialog({
  open,
  onOpenChange,
  instalacaoId,
  veiculoLabel,
  associadoNome,
  onSuccess,
}: Props) {
  const hojeStr = format(new Date(), 'yyyy-MM-dd');

  // Aba ROTA
  const [data, setData] = useState(hojeStr);
  const [rotaId, setRotaId] = useState<string>('');
  const [criandoRota, setCriandoRota] = useState(false);
  const [novaRotaNome, setNovaRotaNome] = useState('');
  const [novaRotaCidade, setNovaRotaCidade] = useState('');
  const [instaladorId, setInstaladorId] = useState<string>('');
  const [periodoRota, setPeriodoRota] = useState<'manha' | 'tarde'>('manha');
  const [motivoRota, setMotivoRota] = useState('');
  const [notificarRota, setNotificarRota] = useState(true);

  // Aba BASE
  const [oficinaId, setOficinaId] = useState<string>('');
  const [dataBase, setDataBase] = useState(hojeStr);
  const [periodoBase, setPeriodoBase] = useState<'manha' | 'tarde'>('manha');
  const [motivoBase, setMotivoBase] = useState('');
  const [notificarBase, setNotificarBase] = useState(true);

  // Expediente reduzido aos sábados: 09:00–13:00 (sem turno da tarde)
  const isSabado = (s: string) => {
    if (!s) return false;
    const d = new Date(`${s}T12:00:00`);
    return d.getDay() === 6;
  };
  const sabadoRota = isSabado(data);
  const sabadoBase = isSabado(dataBase);
  useEffect(() => {
    if (sabadoRota && periodoRota === 'tarde') setPeriodoRota('manha');
  }, [sabadoRota, periodoRota]);
  useEffect(() => {
    if (sabadoBase && periodoBase === 'tarde') setPeriodoBase('manha');
  }, [sabadoBase, periodoBase]);

  const { data: instaladores = [] } = useInstaladores();
  const { data: bases = [] } = useBasesPratic();
  const { data: manualAtiva = false } = useConfigAtribuicaoManual();
  const { realocarParaRota, realocarParaBase } = useRealocarInstalacao();

  // Rotas do dia selecionado
  const { data: rotasDoDia = [], isLoading: loadingRotas } = useQuery({
    queryKey: ['rotas-do-dia-realocar', data],
    enabled: open && !!data,
    queryFn: async () => {
      const { data: rotas } = await supabase
        .from('rotas')
        .select('id, codigo, nome, cidade, instalador_id, instalador:profiles!rotas_instalador_id_fkey(nome)')
        .eq('data_rota', data)
        .neq('status', 'cancelada')
        .order('codigo');
      const ids = (rotas || []).map((r: any) => r.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: insts } = await supabase
          .from('instalacoes')
          .select('rota_id')
          .in('rota_id', ids);
        (insts || []).forEach((i: any) => {
          if (i.rota_id) counts[i.rota_id] = (counts[i.rota_id] || 0) + 1;
        });
      }
      return (rotas || []).map((r: any) => ({ ...r, qtd: counts[r.id] || 0 }));
    },
  });

  const rotaSelecionada = useMemo(
    () => rotasDoDia.find((r: any) => r.id === rotaId),
    [rotasDoDia, rotaId],
  );

  // Auto-preencher instalador quando a rota tem um
  const instaladorEfetivo = instaladorId || rotaSelecionada?.instalador_id || '';

  const handleRealocarRota = async () => {
    if (!motivoRota.trim()) return;

    // Modo Atribuição Manual: envia para fila sem rota/instalador
    if (manualAtiva) {
      await realocarParaRota.mutateAsync({
        instalacaoId,
        rotaId: null,
        instaladorId: null,
        dataAgendada: data,
        periodo: periodoRota,
        motivo: motivoRota.trim(),
        notificarWhatsApp: notificarRota,
      });
      onSuccess?.();
      onOpenChange(false);
      return;
    }

    let rotaFinalId = rotaId;

    if (criandoRota) {
      if (!novaRotaNome.trim()) return;
      const codigo = `ROT-${format(new Date(data), 'yyyyMMdd')}-TMP`;
      const { data: nova, error } = await supabase
        .from('rotas')
        .insert([{
          codigo,
          nome: novaRotaNome.trim(),
          cidade: novaRotaCidade.trim() || null,
          data_rota: data,
          status: 'pendente',
          instalador_id: instaladorId || null,
        } as any])
        .select()
        .single();
      if (error) {
        console.error(error);
        return;
      }
      rotaFinalId = nova.id;
    }

    if (!rotaFinalId) return;

    await realocarParaRota.mutateAsync({
      instalacaoId,
      rotaId: rotaFinalId,
      instaladorId: instaladorEfetivo || null,
      dataAgendada: data,
      periodo: periodoRota,
      motivo: motivoRota.trim(),
      notificarWhatsApp: notificarRota,
    });
    onSuccess?.();
    onOpenChange(false);
  };

  const handleRealocarBase = async () => {
    if (!oficinaId || !motivoBase.trim()) return;
    const baseSel = bases.find((b) => b.id === oficinaId);
    await realocarParaBase.mutateAsync({
      instalacaoId,
      oficinaId,
      oficinaNome: baseSel?.nome_fantasia || baseSel?.razao_social || 'Base',
      dataAgendada: dataBase,
      periodo: periodoBase,
      motivo: motivoBase.trim(),
      notificarWhatsApp: notificarBase,
    });
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" />
            Realocar serviço
          </DialogTitle>
          <DialogDescription>
            {veiculoLabel || 'Veículo'} {associadoNome ? `— ${associadoNome}` : ''}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="rota" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="rota" className="gap-1.5">
              <RouteIcon className="h-4 w-4" /> Rota
            </TabsTrigger>
            <TabsTrigger value="base" className="gap-1.5">
              <Building2 className="h-4 w-4" /> Base
            </TabsTrigger>
          </TabsList>

          {/* ABA ROTA */}
          <TabsContent value="rota" className="space-y-3 pt-3">
            {manualAtiva && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Modo Atribuição Manual ativo — o serviço será reagendado para a data/período escolhidos e entrará na fila de Atribuição Manual. Você designará o instalador depois pelo mapa.</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  min={hojeStr}
                  value={data}
                  onChange={(e) => { setData(e.target.value); setRotaId(''); }}
                />
              </div>
              <div>
                <Label>Período</Label>
                <Select value={periodoRota} onValueChange={(v) => setPeriodoRota(v as 'manha' | 'tarde')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (08:00 – 12:00)</SelectItem>
                    <SelectItem value="tarde">Tarde (13:00 – 18:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!manualAtiva && (!criandoRota ? (
              <div>
                <Label>Rota</Label>
                <Select value={rotaId} onValueChange={setRotaId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingRotas ? 'Carregando...' : 'Selecione uma rota'} />
                  </SelectTrigger>
                  <SelectContent>
                    {rotasDoDia.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.codigo} {r.nome ? `• ${r.nome}` : ''} {r.instalador?.nome ? `• ${r.instalador.nome}` : '• sem instalador'} ({r.qtd})
                      </SelectItem>
                    ))}
                    {!rotasDoDia.length && !loadingRotas && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem rotas nesta data</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 mt-1 h-auto"
                  onClick={() => { setCriandoRota(true); setRotaId(''); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Criar nova rota
                </Button>
              </div>
            ) : (
              <div className="space-y-2 border border-dashed rounded-md p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase text-muted-foreground">Nova rota</Label>
                  <Button variant="ghost" size="sm" onClick={() => setCriandoRota(false)}>
                    Cancelar
                  </Button>
                </div>
                <Input
                  placeholder="Nome da rota *"
                  value={novaRotaNome}
                  onChange={(e) => setNovaRotaNome(e.target.value)}
                />
                <Input
                  placeholder="Cidade"
                  value={novaRotaCidade}
                  onChange={(e) => setNovaRotaCidade(e.target.value)}
                />
              </div>
            ))}

            {!manualAtiva && (
              <div>
                <Label>Instalador {!criandoRota && rotaSelecionada?.instalador?.nome ? '(opcional, sobrescreve)' : ''}</Label>
                <Select value={instaladorId} onValueChange={setInstaladorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      rotaSelecionada?.instalador?.nome
                        ? `Padrão: ${rotaSelecionada.instalador.nome}`
                        : 'Selecione um instalador'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {instaladores.map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Motivo da realocação *</Label>
              <Textarea
                rows={2}
                value={motivoRota}
                onChange={(e) => setMotivoRota(e.target.value)}
                placeholder="Ex: cliente solicitou, técnico indisponível..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={notificarRota} onCheckedChange={(v) => setNotificarRota(!!v)} />
              Notificar associado por WhatsApp
            </label>

            <Button
              className="w-full"
              onClick={handleRealocarRota}
              disabled={
                realocarParaRota.isPending ||
                !motivoRota.trim() ||
                (!manualAtiva && !criandoRota && !rotaId) ||
                (!manualAtiva && criandoRota && !novaRotaNome.trim())
              }
            >
              {realocarParaRota.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {manualAtiva ? 'Reagendar e enviar para fila' : 'Realocar para esta rota'}
            </Button>
          </TabsContent>

          {/* ABA BASE */}
          <TabsContent value="base" className="space-y-3 pt-3">
            {manualAtiva && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Modo Atribuição Manual ativo — o serviço entrará na fila de atribuição para você designar o instalador no mapa.</span>
              </div>
            )}
            <div>
              <Label>Base (oficina Pratic)</Label>
              <Select value={oficinaId} onValueChange={setOficinaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome_fantasia || b.razao_social}
                    </SelectItem>
                  ))}
                  {!bases.length && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma base cadastrada</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  min={hojeStr}
                  value={dataBase}
                  onChange={(e) => setDataBase(e.target.value)}
                />
              </div>
              <div>
                <Label>Período</Label>
                <Select value={periodoBase} onValueChange={(v) => setPeriodoBase(v as 'manha' | 'tarde')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (08:00 – 12:00)</SelectItem>
                    <SelectItem value="tarde">Tarde (13:00 – 18:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Motivo da realocação *</Label>
              <Textarea
                rows={2}
                value={motivoBase}
                onChange={(e) => setMotivoBase(e.target.value)}
                placeholder="Ex: cliente prefere comparecer à base..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={notificarBase} onCheckedChange={(v) => setNotificarBase(!!v)} />
              Notificar associado por WhatsApp
            </label>

            <Button
              className="w-full"
              onClick={handleRealocarBase}
              disabled={realocarParaBase.isPending || !oficinaId || !motivoBase.trim()}
            >
              {realocarParaBase.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Realocar para esta base
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
