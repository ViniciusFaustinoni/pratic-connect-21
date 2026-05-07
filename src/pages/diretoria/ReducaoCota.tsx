import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, Info, Loader2, Save, ShieldCheck, TrendingDown, Percent,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';

// ──────────────────────────────────────────────────────────────────────────────
// Chaves canônicas (mesmas usadas pelos hooks existentes — não migrar)
// ──────────────────────────────────────────────────────────────────────────────
const CHAVES = [
  // Ativação + limites para a Regra do 1% (FIPE menor)
  'fipe_menor_ativo',
  'fipe_menor_limite_minimo',
  'fipe_menor_limite_carro',
  'fipe_menor_limite_moto',
  // Cotas/exceções por desempenho do consultor
  'excecao_faixas_vendas',
  'excecao_fipe_max_carro',
  'excecao_fipe_max_moto',
  'excecao_historico_boletos_ativo',
  'excecao_historico_boletos_minimo',
  'excecao_zero_km_ativo',
  // Restrições absolutas
  'restricao_mudanca_linha',
  'restricao_depreciacao_cobertura_100',
  'restricao_blindado_absoluta',
  // Dupla aprovação FIPE alto valor
  'dupla_aprovacao_fipe_diretoria_ativa',
  'dupla_aprovacao_fipe_minimo_votos',
] as const;

interface FaixaVenda { min: number; max: number | null; permitidas: number; }

interface State {
  fipe_menor_ativo: boolean;
  fipe_menor_limite_minimo: string;
  fipe_menor_limite_carro: string;
  fipe_menor_limite_moto: string;

  faixas_vendas: FaixaVenda[];
  excecao_fipe_max_carro: string;
  excecao_fipe_max_moto: string;
  excecao_historico_boletos_ativo: boolean;
  excecao_historico_boletos_minimo: string;
  excecao_zero_km_ativo: boolean;

  restricao_mudanca_linha: boolean;
  restricao_depreciacao_cobertura_100: boolean;
  restricao_blindado_absoluta: boolean;

  dupla_aprovacao_fipe_diretoria_ativa: boolean;
  dupla_aprovacao_fipe_minimo_votos: string;
}

const DEFAULTS: State = {
  fipe_menor_ativo: false,
  fipe_menor_limite_minimo: '30000',
  fipe_menor_limite_carro: '120000',
  fipe_menor_limite_moto: '27000',

  faixas_vendas: [
    { min: 0, max: 9, permitidas: 0 },
    { min: 10, max: 19, permitidas: 1 },
    { min: 20, max: 29, permitidas: 2 },
    { min: 30, max: null, permitidas: 3 },
  ],
  excecao_fipe_max_carro: '120000',
  excecao_fipe_max_moto: '27000',
  excecao_historico_boletos_ativo: true,
  excecao_historico_boletos_minimo: '6',
  excecao_zero_km_ativo: true,

  restricao_mudanca_linha: true,
  restricao_depreciacao_cobertura_100: true,
  restricao_blindado_absoluta: true,

  dupla_aprovacao_fipe_diretoria_ativa: false,
  dupla_aprovacao_fipe_minimo_votos: '2',
};

function useReducaoCotaConfig() {
  return useQuery({
    queryKey: ['reducao-cota-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [...CHAVES]);
      if (error) throw error;
      const map = Object.fromEntries((data || []).map(r => [r.chave, r.valor]));

      let faixas = DEFAULTS.faixas_vendas;
      try { if (map.excecao_faixas_vendas) faixas = JSON.parse(map.excecao_faixas_vendas); } catch { /* keep */ }

      const out: State = {
        fipe_menor_ativo: map.fipe_menor_ativo === 'true',
        fipe_menor_limite_minimo: map.fipe_menor_limite_minimo ?? DEFAULTS.fipe_menor_limite_minimo,
        fipe_menor_limite_carro: map.fipe_menor_limite_carro ?? DEFAULTS.fipe_menor_limite_carro,
        fipe_menor_limite_moto: map.fipe_menor_limite_moto ?? DEFAULTS.fipe_menor_limite_moto,

        faixas_vendas: faixas,
        excecao_fipe_max_carro: map.excecao_fipe_max_carro ?? DEFAULTS.excecao_fipe_max_carro,
        excecao_fipe_max_moto: map.excecao_fipe_max_moto ?? DEFAULTS.excecao_fipe_max_moto,
        excecao_historico_boletos_ativo: map.excecao_historico_boletos_ativo !== 'false',
        excecao_historico_boletos_minimo: map.excecao_historico_boletos_minimo ?? DEFAULTS.excecao_historico_boletos_minimo,
        excecao_zero_km_ativo: map.excecao_zero_km_ativo !== 'false',

        restricao_mudanca_linha: map.restricao_mudanca_linha !== 'false',
        restricao_depreciacao_cobertura_100: map.restricao_depreciacao_cobertura_100 !== 'false',
        restricao_blindado_absoluta: map.restricao_blindado_absoluta !== 'false',

        dupla_aprovacao_fipe_diretoria_ativa: map.dupla_aprovacao_fipe_diretoria_ativa === 'true',
        dupla_aprovacao_fipe_minimo_votos:
          map.dupla_aprovacao_fipe_minimo_votos ?? DEFAULTS.dupla_aprovacao_fipe_minimo_votos,
      };
      return out;
    },
    staleTime: 60_000,
  });
}

export default function ReducaoCota() {
  const qc = useQueryClient();
  const { data, isLoading } = useReducaoCotaConfig();
  const [s, setS] = useState<State>(DEFAULTS);
  const [initialized, setInit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !initialized) { setS(data); setInit(true); }
  }, [data, initialized]);

  const setFaixa = (i: number, field: keyof FaixaVenda, value: string) => {
    setS(prev => {
      const faixas = [...prev.faixas_vendas];
      if (field === 'max') {
        faixas[i] = { ...faixas[i], max: value === '' ? null : parseInt(value) || 0 };
      } else {
        faixas[i] = { ...faixas[i], [field]: parseInt(value) || 0 };
      }
      return { ...prev, faixas_vendas: faixas };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {
        fipe_menor_ativo: String(s.fipe_menor_ativo),
        fipe_menor_limite_minimo: s.fipe_menor_limite_minimo,
        fipe_menor_limite_carro: s.fipe_menor_limite_carro,
        fipe_menor_limite_moto: s.fipe_menor_limite_moto,

        excecao_faixas_vendas: JSON.stringify(s.faixas_vendas),
        excecao_fipe_max_carro: s.excecao_fipe_max_carro,
        excecao_fipe_max_moto: s.excecao_fipe_max_moto,
        excecao_historico_boletos_ativo: String(s.excecao_historico_boletos_ativo),
        excecao_historico_boletos_minimo: s.excecao_historico_boletos_minimo,
        excecao_zero_km_ativo: String(s.excecao_zero_km_ativo),

        restricao_mudanca_linha: String(s.restricao_mudanca_linha),
        restricao_depreciacao_cobertura_100: String(s.restricao_depreciacao_cobertura_100),
        restricao_blindado_absoluta: String(s.restricao_blindado_absoluta),

        dupla_aprovacao_fipe_diretoria_ativa: String(s.dupla_aprovacao_fipe_diretoria_ativa),
        dupla_aprovacao_fipe_minimo_votos: s.dupla_aprovacao_fipe_minimo_votos,
      };
      const nowIso = new Date().toISOString();
      const rows = Object.entries(updates).map(([chave, valor]) => ({
        chave, valor, updated_at: nowIso,
      }));
      const { error: upErr } = await (supabase as any)
        .from('configuracoes')
        .upsert(rows, { onConflict: 'chave' });
      if (upErr) throw upErr;
      qc.invalidateQueries({ queryKey: ['reducao-cota-config'] });
      qc.invalidateQueries({ queryKey: ['configuracoes-autorizacoes-excecoes'] });
      qc.invalidateQueries({ queryKey: ['config-fipe-menor-limites'] });
      qc.invalidateQueries({ queryKey: ['fipe-menor-ativo'] });
      qc.invalidateQueries({ queryKey: ['configuracao'] });
      qc.invalidateQueries({ queryKey: ['configuracoes'] });
      toast.success('Configurações salvas');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6"><div className="h-64 bg-muted animate-pulse rounded" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Percent className="h-6 w-6 text-primary" />
          Redução de Cota (Regra de 1%)
        </h1>
        <p className="text-muted-foreground">
          Caminho único de configuração da regra de redução de cota — também conhecida como Regra de 1%.
          Centraliza ativação, limites FIPE, cotas por desempenho do consultor, exceções, restrições absolutas e dupla aprovação.
        </p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          Antigamente estas configurações ficavam em <strong>Configurações</strong> e em <strong>Gestão Comercial → Regras de Venda</strong>.
          Agora tudo está nesta única página.
        </AlertDescription>
      </Alert>

      {/* ATIVAÇÃO + LIMITES FIPE DA REGRA */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Ativação e limites FIPE da regra
          </CardTitle>
          <CardDescription>
            Quando ativada, permite enquadrar o veículo em faixa inferior com desconto de 1% na FIPE,
            respeitando os limites mínimos e máximos por tipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm font-medium flex-1">Regra ativa</Label>
            <Switch
              checked={s.fipe_menor_ativo}
              onCheckedChange={(c) => setS(p => ({ ...p, fipe_menor_ativo: c }))}
            />
          </div>

          {s.fipe_menor_ativo && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-primary/20">
              <div className="space-y-1.5">
                <Label className="text-xs">FIPE mínimo (geral)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number" step="100"
                    className="pl-10 h-9"
                    value={s.fipe_menor_limite_minimo}
                    onChange={(e) => setS(p => ({ ...p, fipe_menor_limite_minimo: e.target.value }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Abaixo desse valor a regra não aparece.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Limite máximo — Carros</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number" step="1000"
                    className="pl-10 h-9"
                    value={s.fipe_menor_limite_carro}
                    onChange={(e) => setS(p => ({ ...p, fipe_menor_limite_carro: e.target.value }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Carros acima desse valor não podem solicitar.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Limite máximo — Motos</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number" step="500"
                    className="pl-10 h-9"
                    value={s.fipe_menor_limite_moto}
                    onChange={(e) => setS(p => ({ ...p, fipe_menor_limite_moto: e.target.value }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Motos acima desse valor não podem solicitar.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* COTAS POR DESEMPENHO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cotas por desempenho do consultor</CardTitle>
          <CardDescription>
            Define quantas solicitações de redução de cota cada consultor pode abrir no mês atual,
            com base nas vendas confirmadas no mês anterior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendas mínimas (mês anterior)</TableHead>
                <TableHead>Vendas máximas (mês anterior)</TableHead>
                <TableHead>Solicitações permitidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.faixas_vendas.map((f, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input type="number" min="0" className="w-24 text-right"
                      value={f.min} onChange={(e) => setFaixa(i, 'min', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" className="w-24 text-right" placeholder="Sem limite"
                      value={f.max ?? ''} onChange={(e) => setFaixa(i, 'max', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" className="w-24 text-right"
                      value={f.permitidas} onChange={(e) => setFaixa(i, 'permitidas', e.target.value)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* LIMITES FIPE PARA EXCEÇÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limites de FIPE para exceções aprovadas</CardTitle>
          <CardDescription>Acima destes valores, nenhuma exceção é permitida.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label className="flex-1 text-sm">FIPE máximo — Carro</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input type="number" min="0" step="1000" className="w-36 text-right"
                value={s.excecao_fipe_max_carro}
                onChange={(e) => setS(p => ({ ...p, excecao_fipe_max_carro: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="flex-1 text-sm">FIPE máximo — Moto</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input type="number" min="0" step="1000" className="w-36 text-right"
                value={s.excecao_fipe_max_moto}
                onChange={(e) => setS(p => ({ ...p, excecao_fipe_max_moto: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Atual: Carro até {formatarMoeda(parseFloat(s.excecao_fipe_max_carro) || 0)} ·
            Moto até {formatarMoeda(parseFloat(s.excecao_fipe_max_moto) || 0)}
          </p>
        </CardContent>
      </Card>

      {/* CONDIÇÕES ESPECIAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condições especiais para liberar exceção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Veículo Zero KM</Label>
              <p className="text-xs text-muted-foreground">Quando ativado, 0 km pode ser aceito independente da faixa FIPE.</p>
            </div>
            <Switch checked={s.excecao_zero_km_ativo}
              onCheckedChange={(c) => setS(p => ({ ...p, excecao_zero_km_ativo: c }))} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Histórico de boletos pagos</Label>
              <p className="text-xs text-muted-foreground">Associados com mínimo de boletos pagos podem ser aceitos como exceção.</p>
            </div>
            <Switch checked={s.excecao_historico_boletos_ativo}
              onCheckedChange={(c) => setS(p => ({ ...p, excecao_historico_boletos_ativo: c }))} />
          </div>
          {s.excecao_historico_boletos_ativo && (
            <div className="flex items-center justify-between gap-4 ml-6">
              <Label className="flex-1 text-sm">Quantidade mínima de boletos pagos</Label>
              <Input type="number" min="1" className="w-24 text-right"
                value={s.excecao_historico_boletos_minimo}
                onChange={(e) => setS(p => ({ ...p, excecao_historico_boletos_minimo: e.target.value }))} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* RESTRIÇÕES ABSOLUTAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Restrições absolutas
          </CardTitle>
          <CardDescription>Bloqueiam o cadastro independente de qualquer exceção.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Veículo blindado</Label>
              <p className="text-xs text-muted-foreground">Quando ativado, blindados são automaticamente rejeitados.</p>
            </div>
            <Switch checked={s.restricao_blindado_absoluta}
              onCheckedChange={(c) => setS(p => ({ ...p, restricao_blindado_absoluta: c }))} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Mudança de linha</Label>
              <p className="text-xs text-muted-foreground">Veículos com mudança de linha são rejeitados.</p>
            </div>
            <Switch checked={s.restricao_mudanca_linha}
              onCheckedChange={(c) => setS(p => ({ ...p, restricao_mudanca_linha: c }))} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Depreciação em planos 100%</Label>
              <p className="text-xs text-muted-foreground">Veículos com depreciação acima do limite em planos 100% são rejeitados.</p>
            </div>
            <Switch checked={s.restricao_depreciacao_cobertura_100}
              onCheckedChange={(c) => setS(p => ({ ...p, restricao_depreciacao_cobertura_100: c }))} />
          </div>
        </CardContent>
      </Card>

      {/* DUPLA APROVAÇÃO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Dupla aprovação da diretoria (FIPE alto valor)
          </CardTitle>
          <CardDescription>
            Acima do limite, exige aprovação de múltiplos gestores via WhatsApp antes da assinatura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Exigir dupla aprovação</Label>
              <p className="text-xs text-muted-foreground">Notifica todos os gestores via WhatsApp; bloqueia a cotação até atingir o mínimo de aprovações.</p>
            </div>
            <Switch checked={s.dupla_aprovacao_fipe_diretoria_ativa}
              onCheckedChange={(c) => setS(p => ({ ...p, dupla_aprovacao_fipe_diretoria_ativa: c }))} />
          </div>
          {s.dupla_aprovacao_fipe_diretoria_ativa && (
            <div className="flex items-center justify-between gap-4 ml-6">
              <Label className="flex-1 text-sm">Número mínimo de aprovações</Label>
              <Input type="number" min="1" className="w-24 text-right"
                value={s.dupla_aprovacao_fipe_minimo_votos}
                onChange={(e) => setS(p => ({ ...p, dupla_aprovacao_fipe_minimo_votos: e.target.value }))} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-4 z-10">
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar todas as configurações
        </Button>
      </div>
    </div>
  );
}
