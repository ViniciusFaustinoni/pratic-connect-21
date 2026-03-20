import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Loader2, Clock, MapPin, DollarSign, Truck, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';

// ── Types ──────────────────────────────────────────

interface PrazoEstado {
  estado: string;
  prazo_horas: number;
}

interface RegiaoRota {
  value: string;
  label: string;
  ativa: boolean;
}

const CONFIG_CHAVES = [
  'instalacao_max_por_dia',
  'instalacao_horario_inicio',
  'instalacao_tempo_medio_minutos',
  'instalacao_custo_fora_horario',
  'instalacao_prazos_por_estado',
  'instalacao_regioes_rotas',
] as const;

// ── Hook ───────────────────────────────────────────

function useInstalacaoConfigs() {
  return useQuery({
    queryKey: ['configuracoes-instalacao-rotas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor, updated_at, updated_by')
        .in('chave', [...CONFIG_CHAVES]);
      if (error) throw error;

      const map = Object.fromEntries((data || []).map(d => [d.chave, d]));

      return {
        maxPorDia: map.instalacao_max_por_dia?.valor ?? '6',
        horarioInicio: map.instalacao_horario_inicio?.valor ?? '08:30',
        tempoMedio: map.instalacao_tempo_medio_minutos?.valor ?? '90',
        custoForaHorario: map.instalacao_custo_fora_horario?.valor ?? '50',
        prazosEstado: parsePrazos(map.instalacao_prazos_por_estado?.valor),
        regioes: parseRegioes(map.instalacao_regioes_rotas?.valor),
        updatedAt: map.instalacao_max_por_dia?.updated_at ?? null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

function parsePrazos(raw?: string | null): PrazoEstado[] {
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fallback */ }
  return [
    { estado: 'RJ', prazo_horas: 48 },
    { estado: 'SP', prazo_horas: 72 },
  ];
}

function parseRegioes(raw?: string | null): RegiaoRota[] {
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fallback */ }
  return [];
}

// ── Save helper ────────────────────────────────────

async function salvarConfig(chave: string, valor: string, profileId?: string) {
  const { error } = await supabase
    .from('configuracoes')
    .update({
      valor,
      updated_at: new Date().toISOString(),
      updated_by: profileId ?? null,
    })
    .eq('chave', chave);
  if (error) throw error;
}

// ── Component ──────────────────────────────────────

export function InstalacaoRotasConfig() {
  const { data: config, isLoading } = useInstalacaoConfigs();
  const { profile } = useAuth();
  const qc = useQueryClient();

  // ── Bloco 1 state
  const [maxDia, setMaxDia] = useState('6');
  const [horario, setHorario] = useState('08:30');
  const [tempoMedio, setTempoMedio] = useState('90');
  const [savingB1, setSavingB1] = useState(false);

  // ── Bloco 2 state
  const [prazos, setPrazos] = useState<PrazoEstado[]>([]);
  const [novoEstado, setNovoEstado] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('48');
  const [savingB2, setSavingB2] = useState(false);

  // ── Bloco 3 state
  const [custoFora, setCustoFora] = useState('50');
  const [savingB3, setSavingB3] = useState(false);

  // ── Bloco 4 state
  const [regioes, setRegioes] = useState<RegiaoRota[]>([]);
  const [novaRegiaoLabel, setNovaRegiaoLabel] = useState('');
  const [savingB4, setSavingB4] = useState(false);

  // ── Populate state from DB
  useEffect(() => {
    if (!config) return;
    setMaxDia(config.maxPorDia);
    setHorario(config.horarioInicio);
    setTempoMedio(config.tempoMedio);
    setCustoFora(config.custoForaHorario);
    setPrazos(config.prazosEstado);
    setRegioes(config.regioes);
  }, [config]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['configuracoes-instalacao-rotas'] });

  // ── Bloco 1 save
  const handleSaveCapacidade = async () => {
    setSavingB1(true);
    try {
      await Promise.all([
        salvarConfig('instalacao_max_por_dia', maxDia, profile?.id),
        salvarConfig('instalacao_horario_inicio', horario, profile?.id),
        salvarConfig('instalacao_tempo_medio_minutos', tempoMedio, profile?.id),
      ]);
      toast.success('Capacidade dos instaladores atualizada');
      invalidate();
    } catch {
      toast.error('Erro ao salvar capacidade');
    } finally {
      setSavingB1(false);
    }
  };

  // ── Bloco 2 save
  const handleSavePrazos = async () => {
    setSavingB2(true);
    try {
      await salvarConfig('instalacao_prazos_por_estado', JSON.stringify(prazos), profile?.id);
      toast.success('Prazos por estado atualizados');
      invalidate();
    } catch {
      toast.error('Erro ao salvar prazos');
    } finally {
      setSavingB2(false);
    }
  };

  const addEstado = () => {
    if (!novoEstado.trim()) return;
    if (prazos.some(p => p.estado.toUpperCase() === novoEstado.trim().toUpperCase())) {
      toast.error('Estado já existe na lista');
      return;
    }
    setPrazos(prev => [...prev, { estado: novoEstado.trim().toUpperCase(), prazo_horas: Number(novoPrazo) || 48 }]);
    setNovoEstado('');
    setNovoPrazo('48');
  };

  const removeEstado = (idx: number) => setPrazos(prev => prev.filter((_, i) => i !== idx));

  const updatePrazo = (idx: number, horas: number) => {
    setPrazos(prev => prev.map((p, i) => i === idx ? { ...p, prazo_horas: horas } : p));
  };

  // ── Bloco 3 save
  const handleSaveCusto = async () => {
    setSavingB3(true);
    try {
      await salvarConfig('instalacao_custo_fora_horario', custoFora, profile?.id);
      toast.success('Custo fora do horário atualizado');
      invalidate();
    } catch {
      toast.error('Erro ao salvar custo');
    } finally {
      setSavingB3(false);
    }
  };

  // ── Bloco 4 save
  const handleSaveRegioes = async () => {
    setSavingB4(true);
    try {
      await salvarConfig('instalacao_regioes_rotas', JSON.stringify(regioes), profile?.id);
      toast.success('Regiões de atendimento atualizadas');
      invalidate();
    } catch {
      toast.error('Erro ao salvar regiões');
    } finally {
      setSavingB4(false);
    }
  };

  const addRegiao = () => {
    if (!novaRegiaoLabel.trim()) return;
    const value = novaRegiaoLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (regioes.some(r => r.value === value)) {
      toast.error('Região já existe');
      return;
    }
    setRegioes(prev => [...prev, { value, label: novaRegiaoLabel.trim(), ativa: true }]);
    setNovaRegiaoLabel('');
  };

  const toggleRegiao = (idx: number) => {
    setRegioes(prev => prev.map((r, i) => i === idx ? { ...r, ativa: !r.ativa } : r));
  };

  const removeRegiao = (idx: number) => {
    setRegioes(prev => prev.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Bloco 1 — Capacidade dos Instaladores ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Capacidade dos Instaladores
          </CardTitle>
          <CardDescription>
            Define os limites operacionais para o planejamento diário de rotas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Máx. instalações por dia</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxDia}
                onChange={e => setMaxDia(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário de início das rotas</Label>
              <Input
                type="time"
                value={horario}
                onChange={e => setHorario(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tempo médio por instalação (min)</Label>
              <Input
                type="number"
                min={15}
                max={300}
                value={tempoMedio}
                onChange={e => setTempoMedio(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveCapacidade} disabled={savingB1} size="sm">
              {savingB1 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar Capacidade
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bloco 2 — Prazos por Estado ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Prazos de Instalação por Estado
          </CardTitle>
          <CardDescription>
            Prazo máximo em horas úteis para realizar a instalação após aprovação do cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Estado</TableHead>
                <TableHead>Prazo (horas úteis)</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prazos.map((p, i) => (
                <TableRow key={p.estado}>
                  <TableCell className="font-medium">{p.estado}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      className="w-28 h-8"
                      value={p.prazo_horas}
                      onChange={e => updatePrazo(i, Number(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={() => removeEstado(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Sigla do estado</Label>
              <Input
                value={novoEstado}
                onChange={e => setNovoEstado(e.target.value)}
                placeholder="Ex: MG"
                className="w-24 h-8 uppercase"
                maxLength={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prazo (h)</Label>
              <Input
                type="number"
                value={novoPrazo}
                onChange={e => setNovoPrazo(e.target.value)}
                className="w-24 h-8"
                min={1}
              />
            </div>
            <Button variant="outline" size="sm" onClick={addEstado} disabled={!novoEstado.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePrazos} disabled={savingB2} size="sm">
              {savingB2 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar Prazos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bloco 3 — Custo Fora do Horário ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Custo de Atendimento Fora do Horário
          </CardTitle>
          <CardDescription>
            Valor de repasse cobrado ao associado quando a instalação é realizada fora do horário comercial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>Valor do repasse (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={custoFora}
              onChange={e => setCustoFora(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valor atual: {formatarMoeda(Number(custoFora) || 0)}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveCusto} disabled={savingB3} size="sm">
              {savingB3 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar Custo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bloco 4 — Regiões de Atendimento ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Regiões de Atendimento
          </CardTitle>
          <CardDescription>
            Regiões disponíveis para organização das rotas. Regiões desativadas não aparecem para o coordenador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/50 divide-y divide-border/50">
            {regioes.map((r, i) => (
              <div key={r.value} className="flex items-center justify-between px-4 py-2.5">
                <span className={r.ativa ? 'text-sm' : 'text-sm text-muted-foreground line-through'}>
                  {r.label}
                </span>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={r.ativa}
                    onCheckedChange={() => toggleRegiao(i)}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => removeRegiao(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {regioes.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma região cadastrada.</p>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label className="text-xs">Nome da região</Label>
              <Input
                value={novaRegiaoLabel}
                onChange={e => setNovaRegiaoLabel(e.target.value)}
                placeholder="Ex: Baixada Fluminense"
                className="h-8"
                onKeyDown={e => e.key === 'Enter' && addRegiao()}
              />
            </div>
            <Button variant="outline" size="sm" onClick={addRegiao} disabled={!novaRegiaoLabel.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveRegioes} disabled={savingB4} size="sm">
              {savingB4 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar Regiões
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
