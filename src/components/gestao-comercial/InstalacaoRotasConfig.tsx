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
  'jornada_duracao_turno_horas',
  'jornada_horas_ate_almoco',
  'jornada_duracao_almoco_minutos',
  'jornada_tolerancia_atraso_minutos',
  'jornada_produtividade_minima',
  'jornada_horas_alerta_improdutividade',
  'sla_horas_instalacao',
  'sla_horas_manutencao',
  'gps_validacao_ativa',
  'gps_raio_metros',
  'jornada_limite_debito_horas',
  'jornada_exibir_saldo_vistoriador',
  'recusa_exigir_motivo',
  'recusa_limite_alerta',
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
        jornadaDuracaoTurno: map.jornada_duracao_turno_horas?.valor ?? '8',
        jornadaHorasAteAlmoco: map.jornada_horas_ate_almoco?.valor ?? '4',
        jornadaDuracaoAlmoco: map.jornada_duracao_almoco_minutos?.valor ?? '60',
        jornadaToleranciaAtraso: map.jornada_tolerancia_atraso_minutos?.valor ?? '0',
        jornadaProdutividadeMinima: map.jornada_produtividade_minima?.valor ?? '1',
        jornadaAlertaImprodutividade: map.jornada_horas_alerta_improdutividade?.valor ?? '2',
        slaInstalacao: map.sla_horas_instalacao?.valor ?? '48',
        slaManutencao: map.sla_horas_manutencao?.valor ?? '24',
        gpsValidacaoAtiva: map.gps_validacao_ativa?.valor ?? 'true',
        gpsRaioMetros: map.gps_raio_metros?.valor ?? '500',
        limiteDebito: map.jornada_limite_debito_horas?.valor ?? '0',
        exibirSaldo: map.jornada_exibir_saldo_vistoriador?.valor ?? 'true',
        recusaExigirMotivo: map.recusa_exigir_motivo?.valor ?? 'true',
        recusaLimiteAlerta: map.recusa_limite_alerta?.valor ?? '3',
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

  // ── Bloco 5 state (Jornada)
  const [jornadaTurno, setJornadaTurno] = useState('8');
  const [jornadaAlmoco, setJornadaAlmoco] = useState('4');
  const [jornadaDuracaoAlmoco, setJornadaDuracaoAlmoco] = useState('60');
  const [jornadaTolerancia, setJornadaTolerancia] = useState('0');
  const [jornadaProdMin, setJornadaProdMin] = useState('1');
  const [jornadaAlertaImprod, setJornadaAlertaImprod] = useState('2');
  const [savingB5, setSavingB5] = useState(false);

  // ── Bloco 6 state (SLA)
  const [slaInstalacao, setSlaInstalacao] = useState('48');
  const [slaManutencao, setSlaManutencao] = useState('24');
  const [savingB6, setSavingB6] = useState(false);

  // ── Bloco 5b state (Débito/Saldo)
  const [limiteDebito, setLimiteDebito] = useState('0');
  const [exibirSaldo, setExibirSaldo] = useState(true);

  // ── Bloco 7 state (GPS)
  const [gpsAtiva, setGpsAtiva] = useState(true);
  const [gpsRaio, setGpsRaio] = useState('500');
  const [savingB7, setSavingB7] = useState(false);

  // ── Bloco 8 state (Recusas)
  const [recusaExigirMotivo, setRecusaExigirMotivo] = useState(true);
  const [recusaLimiteAlerta, setRecusaLimiteAlerta] = useState('3');
  const [savingB8, setSavingB8] = useState(false);

  // ── Populate state from DB
  useEffect(() => {
    if (!config) return;
    setMaxDia(config.maxPorDia);
    setHorario(config.horarioInicio);
    setTempoMedio(config.tempoMedio);
    setCustoFora(config.custoForaHorario);
    setPrazos(config.prazosEstado);
    setRegioes(config.regioes);
    setJornadaTurno(config.jornadaDuracaoTurno);
    setJornadaAlmoco(config.jornadaHorasAteAlmoco);
    setJornadaDuracaoAlmoco(config.jornadaDuracaoAlmoco);
    setJornadaTolerancia(config.jornadaToleranciaAtraso);
    setJornadaProdMin(config.jornadaProdutividadeMinima);
    setJornadaAlertaImprod(config.jornadaAlertaImprodutividade);
    setSlaInstalacao(config.slaInstalacao);
    setSlaManutencao(config.slaManutencao);
    setGpsAtiva(config.gpsValidacaoAtiva !== 'false');
    setGpsRaio(config.gpsRaioMetros);
    setLimiteDebito(config.limiteDebito);
    setExibirSaldo(config.exibirSaldo !== 'false');
    setRecusaExigirMotivo(config.recusaExigirMotivo !== 'false');
    setRecusaLimiteAlerta(config.recusaLimiteAlerta);
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

      {/* ── Bloco 5 — Jornada dos Vistoriadores ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Jornada dos Vistoriadores
          </CardTitle>
          <CardDescription>
            Parâmetros que controlam a jornada de trabalho dos vistoriadores e instaladores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração do turno (horas)</Label>
              <Input type="number" min={1} max={24} step={0.5} value={jornadaTurno} onChange={e => setJornadaTurno(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horas até almoço automático</Label>
              <Input type="number" min={1} max={12} step={0.5} value={jornadaAlmoco} onChange={e => setJornadaAlmoco(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duração do almoço (minutos)</Label>
              <Input type="number" min={15} max={120} value={jornadaDuracaoAlmoco} onChange={e => setJornadaDuracaoAlmoco(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tolerância atraso almoço (minutos)</Label>
              <Input type="number" min={0} max={60} value={jornadaTolerancia} onChange={e => setJornadaTolerancia(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Produtividade mínima (serviços/turno)</Label>
              <Input type="number" min={0} max={20} value={jornadaProdMin} onChange={e => setJornadaProdMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horas sem serviço para alerta</Label>
              <Input type="number" min={0.5} max={8} step={0.5} value={jornadaAlertaImprod} onChange={e => setJornadaAlertaImprod(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Limite de débito para bloqueio (horas)</Label>
              <Input type="number" min={0} max={100} step={1} value={limiteDebito} onChange={e => setLimiteDebito(e.target.value)} />
              <p className="text-xs text-muted-foreground">(0 = desativado)</p>
            </div>
            <div className="flex items-center justify-between col-span-full">
              <div className="space-y-0.5">
                <Label>Exibir saldo de horas para o vistoriador</Label>
                <p className="text-xs text-muted-foreground">Quando ativo, o vistoriador vê seu saldo no perfil do app</p>
              </div>
              <Switch checked={exibirSaldo} onCheckedChange={setExibirSaldo} />
            </div>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-600">
              ⚠ Alterações têm efeito imediato na operação. Informe a equipe antes de alterar.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={async () => {
              setSavingB5(true);
              try {
                await Promise.all([
                  salvarConfig('jornada_duracao_turno_horas', jornadaTurno, profile?.id),
                  salvarConfig('jornada_horas_ate_almoco', jornadaAlmoco, profile?.id),
                  salvarConfig('jornada_duracao_almoco_minutos', jornadaDuracaoAlmoco, profile?.id),
                  salvarConfig('jornada_tolerancia_atraso_minutos', jornadaTolerancia, profile?.id),
                  salvarConfig('jornada_produtividade_minima', jornadaProdMin, profile?.id),
                  salvarConfig('jornada_horas_alerta_improdutividade', jornadaAlertaImprod, profile?.id),
                  salvarConfig('jornada_limite_debito_horas', limiteDebito, profile?.id),
                  salvarConfig('jornada_exibir_saldo_vistoriador', exibirSaldo ? 'true' : 'false', profile?.id),
                ]);
                toast.success('Parâmetros de jornada salvos com sucesso');
                invalidate();
              } catch {
                toast.error('Erro ao salvar parâmetros de jornada');
              } finally {
                setSavingB5(false);
              }
            }} disabled={savingB5} size="sm">
              {savingB5 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar Jornada
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bloco 6 — Prazos de SLA ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Prazos de SLA (Atendimento)
          </CardTitle>
          <CardDescription>
            Prazo máximo para atendimento de cada tipo de serviço. Usado no indicador de prazo visível no app e no painel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prazo instalação/vistoria (horas)</Label>
              <Input type="number" min={1} max={168} value={slaInstalacao} onChange={e => setSlaInstalacao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo manutenção/retirada (horas)</Label>
              <Input type="number" min={1} max={168} value={slaManutencao} onChange={e => setSlaManutencao(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={async () => {
              setSavingB6(true);
              try {
                await Promise.all([
                  salvarConfig('sla_horas_instalacao', slaInstalacao, profile?.id),
                  salvarConfig('sla_horas_manutencao', slaManutencao, profile?.id),
                ]);
                toast.success('Prazos de SLA salvos com sucesso');
                invalidate();
              } catch {
                toast.error('Erro ao salvar prazos de SLA');
              } finally {
                setSavingB6(false);
              }
            }} disabled={savingB6} size="sm">
              {savingB6 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar SLA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bloco 7 — Validação GPS ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Validação de Localização (GPS)
          </CardTitle>
          <CardDescription>
            Exige que o vistoriador esteja no local ao iniciar o serviço. Divergências ficam registradas para auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Exigir validação de localização</Label>
              <p className="text-xs text-muted-foreground">Quando desativado, o serviço inicia sem verificação GPS</p>
            </div>
            <Switch checked={gpsAtiva} onCheckedChange={setGpsAtiva} />
          </div>
          {gpsAtiva && (
            <div className="space-y-2 max-w-xs">
              <Label>Raio máximo de tolerância (metros)</Label>
              <Input type="number" min={50} max={5000} value={gpsRaio} onChange={e => setGpsRaio(e.target.value)} />
            </div>
          )}
          <p className="text-xs text-amber-600">⚠ Alterações têm efeito imediato na operação. Informe a equipe antes de alterar.</p>
          <div className="flex justify-end">
            <Button onClick={async () => {
              setSavingB7(true);
              try {
                await Promise.all([
                  salvarConfig('gps_validacao_ativa', gpsAtiva ? 'true' : 'false', profile?.id),
                  salvarConfig('gps_raio_metros', gpsRaio, profile?.id),
                ]);
                toast.success('Configurações de GPS salvas com sucesso');
                invalidate();
              } catch {
                toast.error('Erro ao salvar configurações de GPS');
              } finally {
                setSavingB7(false);
              }
            }} disabled={savingB7} size="sm">
              {savingB7 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar GPS
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
