import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, Plus, Trash2, MessageSquare, Smartphone, Mail, Phone, Pause, AlertTriangle, XCircle, Info, GripVertical, Play, ExternalLink, Loader2, Power, PowerOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TEMPLATE_PARAMS_MAP,
  VAR_LABELS,
  renderTemplatePreview,
  type CobrancaVar,
  type PreviewContexto,
} from '@/lib/cobranca/templateParams';

interface Etapa {
  id: string;
  dias: number;
  acao: 'whatsapp' | 'sms' | 'email' | 'ligacao' | 'suspensao' | 'negativacao' | 'cancelamento';
  template?: string;
  ativa: boolean;
}

const acoes = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, cor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'sms', label: 'SMS', icon: Smartphone, cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'email', label: 'E-mail', icon: Mail, cor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'ligacao', label: 'Ligação', icon: Phone, cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'suspensao', label: 'Suspensão', icon: Pause, cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'negativacao', label: 'Negativação', icon: AlertTriangle, cor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  { value: 'cancelamento', label: 'Cancelamento', icon: XCircle, cor: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-200' },
];

const etapasPadrao: Etapa[] = [
  { id: crypto.randomUUID(), dias: -6, acao: 'whatsapp', template: 'd_6_lembrete_desconto_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 0, acao: 'whatsapp', template: 'd0_boleto_vence_hoje_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 1, acao: 'whatsapp', template: 'd1_a_d4_boleto_vencido_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 2, acao: 'whatsapp', template: 'd1_a_d4_boleto_vencido_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 3, acao: 'whatsapp', template: 'd1_a_d4_boleto_vencido_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 4, acao: 'whatsapp', template: 'd1_a_d4_boleto_vencido_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 5, acao: 'whatsapp', template: 'd5_ultimo_dia_sem_revistoria_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 6, acao: 'whatsapp', template: 'd6_impedimento_pagamento_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 7, acao: 'whatsapp', template: 'd7_reforco_contato_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 8, acao: 'whatsapp', template: 'd8_urgencia_revistoria_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 9, acao: 'whatsapp', template: 'd9_alerta_retirada_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 10, acao: 'whatsapp', template: 'd10_ultima_tentativa_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 11, acao: 'whatsapp', template: 'd11_aviso_negativacao_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 12, acao: 'whatsapp', template: 'd12_debito_com_multa_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 13, acao: 'whatsapp', template: 'd13_regularize_cadastro_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 14, acao: 'whatsapp', template: 'd14_d61_reativacao_protecao_v1', ativa: true },
  { id: crypto.randomUUID(), dias: 61, acao: 'whatsapp', template: 'd14_d61_reativacao_protecao_v1', ativa: true },
];

const formatDias = (dias: number) => {
  if (dias < 0) return `D${dias}`;
  if (dias === 0) return 'D+0';
  return `D+${dias}`;
};

const getDiasColor = (dias: number) => {
  if (dias < 0) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  if (dias === 0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  if (dias <= 7) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-[10px] px-1.5">Aprovado</Badge>;
    case 'PENDING':
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-[10px] px-1.5">Pendente</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-[10px] px-1.5">Rejeitado</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px] px-1.5">Rascunho</Badge>;
  }
};

export default function ReguaCobranca() {
  const queryClient = useQueryClient();
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState<Partial<Etapa>>({ dias: 0, acao: 'whatsapp', ativa: true });

  // Query templates Meta reais
  const { data: metaTemplates } = useQuery({
    queryKey: ['whatsapp-meta-templates-regua'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_meta_templates')
        .select('id, nome, status, categoria, corpo, header_texto, rodape')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: regua, isLoading } = useQuery({
    queryKey: ['regua-cobranca'],
    queryFn: async () => {
      // Busca a régua mais recente (ativa OU desativada) para permitir toggle
      const { data, error } = await supabase
        .from('reguas_cobranca')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const reguaAtiva = regua?.ativa ?? false;
  const [confirmDesativar, setConfirmDesativar] = useState(false);

  useEffect(() => {
    if (regua?.etapas) {
      setEtapas(regua.etapas as unknown as Etapa[]);
    } else if (!isLoading && !regua) {
      setEtapas(etapasPadrao);
    }
  }, [regua, isLoading]);

  const salvarRegua = useMutation({
    mutationFn: async () => {
      const id = regua?.id ?? crypto.randomUUID();
      const { error } = await supabase
        .from('reguas_cobranca')
        .upsert({
          id,
          nome: regua?.nome ?? 'Régua Padrão',
          etapas: JSON.parse(JSON.stringify(etapas)),
          ativa: regua?.ativa ?? true,
          updated_at: new Date().toISOString()
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Régua salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['regua-cobranca'] });
    },
    onError: () => {
      toast.error('Erro ao salvar régua');
    }
  });

  // Toggle global ativar/desativar régua
  const toggleAtiva = useMutation({
    mutationFn: async (novoEstado: boolean) => {
      if (!regua?.id) {
        // Não há régua persistida ainda — cria uma com o estado escolhido
        const { error } = await supabase
          .from('reguas_cobranca')
          .insert({
            id: crypto.randomUUID(),
            nome: 'Régua Padrão',
            etapas: JSON.parse(JSON.stringify(etapas)),
            ativa: novoEstado,
          } as never);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reguas_cobranca')
          .update({ ativa: novoEstado, updated_at: new Date().toISOString() } as never)
          .eq('id', regua.id);
        if (error) throw error;
      }

      // Auditoria
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('cobranca_eventos').insert({
        associado_id: null,
        tipo: 'regua_status',
        subtipo: novoEstado ? 'ativada' : 'desativada',
        descricao: `Régua de cobrança ${novoEstado ? 'ATIVADA' : 'DESATIVADA'}`,
        dados: { acao: novoEstado ? 'ativada' : 'desativada', usuario_id: userData?.user?.id ?? null },
        automatico: false,
      } as never);
    },
    onSuccess: (_, novoEstado) => {
      toast.success(novoEstado ? 'Régua ATIVADA — disparos liberados' : 'Régua DESATIVADA — nenhum disparo será feito');
      queryClient.invalidateQueries({ queryKey: ['regua-cobranca'] });
    },
    onError: (err: any) => {
      toast.error('Falha ao alterar status: ' + (err?.message || ''));
    },
  });

  const handleToggleAtiva = (novoEstado: boolean) => {
    if (!novoEstado) {
      setConfirmDesativar(true);
    } else {
      toggleAtiva.mutate(true);
    }
  };

  // Estado da última execução manual
  const [ultimaExecucao, setUltimaExecucao] = useState<null | {
    quando: string;
    processados?: number;
    eventos_criados?: number;
    whatsapp_enviados?: number;
    whatsapp_falhas?: number;
    limite_atingido?: boolean;
    error?: string;
  }>(null);

  const executarAgora = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('executar-regua-cobranca', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setUltimaExecucao({
        quando: new Date().toISOString(),
        processados: data?.processados,
        eventos_criados: data?.eventos_criados,
        whatsapp_enviados: data?.whatsapp_enviados,
        whatsapp_falhas: data?.whatsapp_falhas,
        limite_atingido: data?.limite_atingido,
      });
      toast.success(`Régua executada — ${data?.eventos_criados ?? 0} eventos, ${data?.whatsapp_enviados ?? 0} WhatsApp enviados`);
    },
    onError: (err: any) => {
      setUltimaExecucao({ quando: new Date().toISOString(), error: err?.message || 'Erro desconhecido' });
      toast.error('Falha ao executar régua: ' + (err?.message || ''));
    }
  });

  // ===== Falhas SGA (linha digitável ausente) =====
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: falhasSGA } = useQuery({
    queryKey: ['regua-falhas-sga'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobranca_eventos')
        .select('id, created_at, descricao, associado_id, dados, associados!inner(nome, cpf)')
        .eq('tipo', 'whatsapp')
        .eq('dados->>falta_sga', 'true')
        .gte('created_at', seteDiasAtras)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        created_at: string;
        descricao: string | null;
        associado_id: string;
        dados: any;
        associados: { nome: string; cpf: string | null } | null;
      }>;
    },
    refetchInterval: 60_000,
  });

  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);
  const [sincronizandoTodas, setSincronizandoTodas] = useState(false);

  const sincronizarUm = async (associadoId: string, veiculoId: string | null) => {
    const { error } = await supabase.functions.invoke('sga-sync-financeiro-veiculo', {
      body: veiculoId ? { associado_id: associadoId, veiculo_id: veiculoId } : { associado_id: associadoId },
    });
    if (error) throw error;
  };

  const handleSincronizar = async (eventoId: string, associadoId: string, veiculoId: string | null) => {
    setSincronizandoId(eventoId);
    try {
      await sincronizarUm(associadoId, veiculoId);
      toast.success('SGA sincronizado — a falha some na próxima execução da régua');
      queryClient.invalidateQueries({ queryKey: ['regua-falhas-sga'] });
    } catch (e: any) {
      toast.error('Falha ao sincronizar: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setSincronizandoId(null);
    }
  };

  const handleSincronizarTodas = async () => {
    if (!falhasSGA?.length) return;
    setSincronizandoTodas(true);
    let ok = 0;
    let erros = 0;
    for (const f of falhasSGA) {
      try {
        await sincronizarUm(f.associado_id, (f.dados?.veiculo_id as string | null) ?? null);
        ok++;
      } catch {
        erros++;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setSincronizandoTodas(false);
    queryClient.invalidateQueries({ queryKey: ['regua-falhas-sga'] });
    if (erros === 0) toast.success(`${ok} veículo(s) sincronizado(s) com sucesso`);
    else toast.warning(`${ok} sincronizado(s), ${erros} falha(s)`);
  };
  // Seletor de associado: busca rápida por nome/CPF, preview com dados reais
  const [previewAssociadoId, setPreviewAssociadoId] = useState<string>('');
  const [associadoSearch, setAssociadoSearch] = useState<string>('');

  const { data: associadosOptions } = useQuery({
    queryKey: ['regua-preview-associados', associadoSearch],
    queryFn: async () => {
      let query = supabase
        .from('associados')
        .select('id, nome, cpf')
        .eq('status', 'ativo')
        .order('nome')
        .limit(20);
      if (associadoSearch.trim().length >= 2) {
        const term = `%${associadoSearch.trim()}%`;
        query = query.or(`nome.ilike.${term},cpf.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Dados da última cobrança pendente desse associado (SGA preferencial)
  const { data: previewCtxData } = useQuery({
    queryKey: ['regua-preview-ctx', previewAssociadoId],
    enabled: !!previewAssociadoId,
    queryFn: async () => {
      const { data: assoc } = await supabase
        .from('associados')
        .select('id, nome')
        .eq('id', previewAssociadoId)
        .maybeSingle();

      // Tenta cobrança SGA com linha digitável
      const { data: cobSga } = await supabase
        .from('cobrancas')
        .select('valor_final, data_vencimento, linha_digitavel, referencia_mes, referencia_ano, veiculo_id')
        .eq('associado_id', previewAssociadoId)
        .eq('origem', 'sga_hinova')
        .order('data_vencimento', { ascending: false })
        .limit(1)
        .maybeSingle();

      let cobAsaas: { valor: number; data_vencimento: string; linha_digitavel: string | null; veiculo_id: string | null } | null = null;
      if (!cobSga) {
        const { data } = await supabase
          .from('asaas_cobrancas')
          .select('valor, data_vencimento, linha_digitavel, veiculo_id')
          .eq('associado_id', previewAssociadoId)
          .order('data_vencimento', { ascending: false })
          .limit(1)
          .maybeSingle();
        cobAsaas = data as typeof cobAsaas;
      }

      const veiculoId = cobSga?.veiculo_id ?? cobAsaas?.veiculo_id ?? null;
      let placa: string | null = null;
      let modelo: string | null = null;
      if (veiculoId) {
        const { data: vei } = await supabase
          .from('veiculos')
          .select('placa, modelo, marca')
          .eq('id', veiculoId)
          .maybeSingle();
        placa = vei?.placa ?? null;
        modelo = vei ? [vei.marca, vei.modelo].filter(Boolean).join(' ') : null;
      }

      const ctx: PreviewContexto = {
        nome: assoc?.nome ?? null,
        valor: cobSga?.valor_final ?? cobAsaas?.valor ?? null,
        vencimento: cobSga?.data_vencimento ?? cobAsaas?.data_vencimento ?? null,
        mes_ano: cobSga?.referencia_mes && cobSga?.referencia_ano
          ? `${String(cobSga.referencia_mes).padStart(2, '0')}/${cobSga.referencia_ano}`
          : null,
        placa,
        modelo,
        linha_digitavel: cobSga?.linha_digitavel ?? cobAsaas?.linha_digitavel ?? null,
      };
      return ctx;
    },
  });

  const previewCtx: PreviewContexto = previewCtxData ?? {};

  const handleAddEtapa = () => {
    if (novaEtapa.dias === undefined || !novaEtapa.acao) return;
    
    const nova: Etapa = {
      id: crypto.randomUUID(),
      dias: novaEtapa.dias,
      acao: novaEtapa.acao as Etapa['acao'],
      template: novaEtapa.template,
      ativa: true
    };
    
    setEtapas(prev => [...prev, nova].sort((a, b) => a.dias - b.dias));
    setNovaEtapaOpen(false);
    setNovaEtapa({ dias: 0, acao: 'whatsapp', ativa: true });
  };

  const handleRemoveEtapa = (id: string) => {
    setEtapas(prev => prev.filter(e => e.id !== id));
  };

  const handleToggleEtapa = (id: string) => {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, ativa: !e.ativa } : e));
  };

  const handleChangeAcao = (id: string, acao: Etapa['acao']) => {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, acao } : e));
  };

  const handleChangeTemplate = (id: string, template: string) => {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, template: template || undefined } : e));
  };

  const getAcaoInfo = (acao: string) => acoes.find(a => a.value === acao) || acoes[0];
  const acoesMensagem = ['whatsapp', 'sms', 'email'];

  const getTemplateStatus = (templateNome?: string) => {
    if (!templateNome || !metaTemplates) return null;
    const found = metaTemplates.find(t => t.nome === templateNome);
    return found?.status || null;
  };

  const etapasOrdenadas = [...etapas].sort((a, b) => a.dias - b.dias);

  const renderTemplateSelect = (value: string | undefined, onChange: (v: string) => void) => {
    const status = getTemplateStatus(value);
    const vars: CobrancaVar[] | null = value ? (TEMPLATE_PARAMS_MAP[value] ?? null) : null;
    const exigeSGA = !!vars?.includes('linha_digitavel');
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecionar template" />
            </SelectTrigger>
            <SelectContent>
              {metaTemplates?.map((t) => (
                <SelectItem key={t.nome} value={t.nome}>
                  <div className="flex items-center gap-2">
                    <span>{t.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status && getStatusBadge(status)}
          {exigeSGA && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-[10px] px-1.5 cursor-help">
                    Requer SGA
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Este template usa a <strong>linha digitável</strong> do boleto.
                  O envio só ocorre se a cobrança SGA (origem <code>sga_hinova</code>) tiver linha digitável sincronizada.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {value && (
            <Link
              to="/configuracoes/integracoes/whatsapp?tab=templates"
              target="_blank"
              rel="noreferrer"
              title="Editar template no catálogo Meta"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {vars && vars.length > 0 && (
          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1">
            <span className="font-medium">Variáveis:</span>
            {vars.map((v, idx) => (
              <span key={idx} className="inline-flex items-center gap-0.5">
                <code className="bg-muted px-1 rounded">{`{{${idx + 1}}}`}</code>
                <span>{VAR_LABELS[v]}</span>
                {idx < vars.length - 1 && <span>·</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Etapas WhatsApp/SMS/Email com template não aprovado
  const etapasComTemplateNaoAprovado = etapas.filter((e) => {
    if (!acoesMensagem.includes(e.acao)) return false;
    if (!e.template) return false;
    const status = getTemplateStatus(e.template);
    return status !== 'APPROVED';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Régua de Relacionamento</h1>
          <p className="text-muted-foreground">Configure o fluxo automatizado de relacionamento</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => executarAgora.mutate()}
            disabled={executarAgora.isPending}
          >
            {executarAgora.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Executar Agora
          </Button>
          <Button onClick={() => salvarRegua.mutate()} disabled={salvarRegua.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configuração
          </Button>
        </div>
      </div>

      {/* Alerta Explicativo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Como funciona:</strong> Configure as ações automáticas baseadas no vencimento. Os templates são enviados via API Oficial da Meta e precisam estar com status <strong>Aprovado</strong> para funcionar.
          <br />
          <span className="text-blue-600 dark:text-blue-400">Dias negativos (D-6)</span> = antes do vencimento |{' '}
          <span className="text-yellow-600 dark:text-yellow-400">D+0</span> = dia do vencimento |{' '}
          <span className="text-red-600 dark:text-red-400">Dias positivos (D+7)</span> = após vencimento
        </AlertDescription>
      </Alert>

      {/* Banner: falhas SGA */}
      {(falhasSGA?.length ?? 0) > 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span className="text-amber-900 dark:text-amber-200">
              <strong>{falhasSGA!.length}</strong>{' '}
              {falhasSGA!.length === 1 ? 'cobrança foi bloqueada' : 'cobranças foram bloqueadas'} nos últimos 7 dias por falta de linha digitável do SGA.
            </span>
            <button
              type="button"
              onClick={() => document.getElementById('card-falhas-sga')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm underline text-amber-900 dark:text-amber-200 whitespace-nowrap text-left"
            >
              Ver lista e sincronizar
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Banner: templates não aprovados */}
      {etapasComTemplateNaoAprovado.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span>
              <strong>{etapasComTemplateNaoAprovado.length}</strong>{' '}
              {etapasComTemplateNaoAprovado.length === 1 ? 'etapa usa template' : 'etapas usam templates'} não aprovados pela Meta — não serão enviadas até a aprovação.
            </span>
            <Link
              to="/configuracoes/integracoes/whatsapp?tab=templates"
              target="_blank"
              rel="noreferrer"
              className="text-sm underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              Abrir catálogo de templates Meta <ExternalLink className="h-3 w-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Card: Última execução */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Execução automática
          </CardTitle>
          <CardDescription>
            Roda diariamente às 09:00 (BRT). Use "Executar Agora" para disparar manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ultimaExecucao ? (
            ultimaExecucao.error ? (
              <div className="text-sm text-destructive">
                Última execução em {new Date(ultimaExecucao.quando).toLocaleString('pt-BR')} — <strong>falhou:</strong> {ultimaExecucao.error}
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <div className="text-muted-foreground">
                  Última execução: <strong className="text-foreground">{new Date(ultimaExecucao.quando).toLocaleString('pt-BR')}</strong>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>Associados processados: <strong>{ultimaExecucao.processados ?? 0}</strong></span>
                  <span>Eventos: <strong>{ultimaExecucao.eventos_criados ?? 0}</strong></span>
                  <span className="text-green-700 dark:text-green-400">WhatsApp enviados: <strong>{ultimaExecucao.whatsapp_enviados ?? 0}</strong></span>
                  {(ultimaExecucao.whatsapp_falhas ?? 0) > 0 && (
                    <span className="text-destructive">Falhas: <strong>{ultimaExecucao.whatsapp_falhas}</strong></span>
                  )}
                </div>
                {ultimaExecucao.limite_atingido && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    ⚠️ Limite de disparos por execução atingido — restante será processado na próxima rodada.
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhuma execução manual nesta sessão. Clique em "Executar Agora" para testar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card: Cobranças bloqueadas — falta linha digitável */}
      <Card id="card-falhas-sga" className={(falhasSGA?.length ?? 0) > 0 ? 'border-amber-300 dark:border-amber-800' : ''}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Cobranças bloqueadas — falta linha digitável (SGA)
              </CardTitle>
              <CardDescription>
                Mensagens não enviadas nos últimos 7 dias porque o template exige a linha digitável e o SGA ainda não retornou o boleto.
                {(falhasSGA?.length ?? 0) > 0 && (
                  <> {' '}<strong className="text-foreground">{falhasSGA!.length}</strong> ocorrência(s).</>
                )}
              </CardDescription>
            </div>
            {(falhasSGA?.length ?? 0) >= 2 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSincronizarTodas}
                disabled={sincronizandoTodas}
              >
                {sincronizandoTodas ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Sincronizar todas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!falhasSGA || falhasSGA.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma cobrança bloqueada nos últimos 7 dias 🎉
            </div>
          ) : (
            <div className="divide-y">
              {falhasSGA.map((f) => {
                const dias = typeof f.dados?.dia_regua === 'number' ? f.dados.dia_regua : null;
                const etapa = dias === null ? '—' : dias < 0 ? `D${dias}` : dias === 0 ? 'D+0' : `D+${dias}`;
                const template = f.dados?.template ?? '—';
                const veiculoId = (f.dados?.veiculo_id as string | null) ?? null;
                const isLoading = sincronizandoId === f.id;
                return (
                  <div key={f.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        <Link to={`/cadastro/associados/${f.associado_id}`} className="hover:underline">
                          {f.associados?.nome ?? '(sem nome)'}
                        </Link>
                        {f.associados?.cpf && (
                          <span className="text-xs text-muted-foreground ml-2">{f.associados.cpf}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span>Etapa: <strong className="text-foreground">{etapa}</strong></span>
                        <span>Template: <code className="bg-muted px-1 rounded text-[11px]">{template}</code></span>
                        <span>{new Date(f.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSincronizar(f.id, f.associado_id, veiculoId)}
                      disabled={isLoading || sincronizandoTodas}
                      className="whitespace-nowrap"
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                      Sincronizar SGA
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card: Seletor de associado para preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Pré-visualização de mensagens
          </CardTitle>
          <CardDescription>
            Selecione um associado para simular como cada mensagem será renderizada com os dados reais dele (nome, valor, vencimento, placa e linha digitável). Sem associado, usa dados de exemplo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <Label className="text-xs">Buscar associado</Label>
              <Input
                placeholder="Nome ou CPF (mín. 2 caracteres)"
                value={associadoSearch}
                onChange={(e) => setAssociadoSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Associado para preview</Label>
              <Select
                value={previewAssociadoId || 'mock'}
                onValueChange={(v) => setPreviewAssociadoId(v === 'mock' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usar dados de exemplo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">— Dados de exemplo (João da Silva) —</SelectItem>
                  {(associadosOptions ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} {a.cpf ? `· ${a.cpf}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {previewAssociadoId && previewCtxData && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span><strong>Nome:</strong> {previewCtxData.nome ?? '—'}</span>
              <span><strong>Vencimento:</strong> {previewCtxData.vencimento ?? '—'}</span>
              <span><strong>Valor:</strong> {previewCtxData.valor != null ? previewCtxData.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
              <span><strong>Placa:</strong> {previewCtxData.placa ?? '—'}</span>
              <span><strong>Modelo:</strong> {previewCtxData.modelo ?? '—'}</span>
              <span className={previewCtxData.linha_digitavel ? '' : 'text-amber-600 dark:text-amber-400'}>
                <strong>Linha digitável:</strong> {previewCtxData.linha_digitavel ? `${previewCtxData.linha_digitavel.slice(0, 20)}…` : 'sem dado SGA'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linha do Tempo</CardTitle>
          <CardDescription>Visualização do fluxo de cobrança — {etapasOrdenadas.length} etapas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="flex items-center overflow-x-auto pb-4 gap-2">
              {etapasOrdenadas.map((etapa, idx) => {
                const acaoInfo = getAcaoInfo(etapa.acao);
                const Icon = acaoInfo.icon;
                return (
                  <div key={etapa.id} className="flex items-center">
                    {idx > 0 && <div className="w-8 h-0.5 bg-border" />}
                    <div className={`flex flex-col items-center min-w-[80px] ${!etapa.ativa ? 'opacity-40' : ''}`}>
                      <Badge className={getDiasColor(etapa.dias)}>
                        {formatDias(etapa.dias)}
                      </Badge>
                      <div className={`mt-2 p-2 rounded-full ${acaoInfo.cor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs mt-1 text-muted-foreground">{acaoInfo.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Etapas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Etapas Configuradas</CardTitle>
            <CardDescription>{etapas.length} etapas no fluxo</CardDescription>
          </div>
          <Button onClick={() => setNovaEtapaOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Etapa
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {etapasOrdenadas.map((etapa) => {
            const acaoInfo = getAcaoInfo(etapa.acao);
            const Icon = acaoInfo.icon;
            const mostraTemplate = acoesMensagem.includes(etapa.acao);

            const tplData = etapa.template ? metaTemplates?.find((t) => t.nome === etapa.template) : null;
            const previewText = tplData?.corpo
              ? renderTemplatePreview(etapa.template, tplData.corpo, previewCtx)
              : null;
            const previewHeader = tplData?.header_texto
              ? renderTemplatePreview(etapa.template, tplData.header_texto, previewCtx)
              : null;
            const previewFooter = tplData?.rodape ?? null;

            return (
              <div
                key={etapa.id}
                className={`flex flex-col gap-3 p-4 rounded-lg border ${
                  !etapa.ativa ? 'opacity-50 bg-muted/50' : 'bg-card'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Badge className={getDiasColor(etapa.dias)}>
                      {formatDias(etapa.dias)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-1">
                    <div className={`p-1.5 rounded ${acaoInfo.cor}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <Select
                      value={etapa.acao}
                      onValueChange={(v) => handleChangeAcao(etapa.id, v as Etapa['acao'])}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {acoes.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {mostraTemplate && renderTemplateSelect(
                    etapa.template,
                    (v) => handleChangeTemplate(etapa.id, v)
                  )}

                  <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={etapa.ativa}
                        onCheckedChange={() => handleToggleEtapa(etapa.id)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {etapa.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEtapa(etapa.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Bolha de preview WhatsApp */}
                {mostraTemplate && previewText && (
                  <div className="ml-7 sm:ml-12">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Pré-visualização — como o associado verá:
                    </div>
                    <div className="max-w-xl rounded-lg rounded-tl-none bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-sm whitespace-pre-wrap font-sans text-foreground shadow-sm">
                      {previewHeader && (
                        <div className="font-semibold mb-1">{previewHeader}</div>
                      )}
                      <div>{previewText}</div>
                      {previewFooter && (
                        <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-900 text-[11px] text-muted-foreground italic">
                          {previewFooter}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {mostraTemplate && !etapa.template && (
                  <div className="ml-7 sm:ml-12 text-xs text-muted-foreground italic">
                    Selecione um template para visualizar a mensagem renderizada.
                  </div>
                )}
              </div>
            );
          })}

          {etapas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma etapa configurada. Clique em "Adicionar Etapa" para começar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Adicionar Etapa */}
      <Dialog open={novaEtapaOpen} onOpenChange={setNovaEtapaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dias (relativo ao vencimento)</Label>
              <Input
                type="number"
                value={novaEtapa.dias ?? 0}
                onChange={(e) => setNovaEtapa(prev => ({ ...prev, dias: parseInt(e.target.value) || 0 }))}
                placeholder="Ex: -3 (antes) ou 7 (depois)"
              />
              <p className="text-xs text-muted-foreground">
                Use valores negativos para ações antes do vencimento
              </p>
            </div>

            <div className="space-y-2">
              <Label>Ação</Label>
              <Select
                value={novaEtapa.acao}
                onValueChange={(v) => setNovaEtapa(prev => ({ ...prev, acao: v as Etapa['acao'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ação" />
                </SelectTrigger>
                <SelectContent>
                  {acoes.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      <div className="flex items-center gap-2">
                        <a.icon className="h-4 w-4" />
                        {a.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {novaEtapa.acao && acoesMensagem.includes(novaEtapa.acao) && (
              <div className="space-y-2">
                <Label>Template de Mensagem</Label>
                <Select
                  value={novaEtapa.template || ''}
                  onValueChange={(v) => setNovaEtapa(prev => ({ ...prev, template: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {metaTemplates?.map((t) => (
                      <SelectItem key={t.nome} value={t.nome}>
                        <div className="flex items-center gap-2">
                          <span>{t.nome}</span>
                          {getStatusBadge(t.status || 'DRAFT')}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaEtapaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddEtapa}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
