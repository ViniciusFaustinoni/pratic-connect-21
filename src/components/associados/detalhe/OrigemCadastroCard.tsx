import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus, ExternalLink, ShieldCheck, Building2, CalendarCheck,
  RefreshCw, ArrowRightLeft, Car, Users, Plus,
} from 'lucide-react';

interface Props {
  associadoId: string;
  canLinkToAssociado?: boolean;
}

// ============================================
// TIPOS
// ============================================

type TipoEntradaKey = 'adesao' | 'migracao' | 'indicacao' | 'reativacao' | 'troca_titularidade' | 'substituicao_placa' | 'inclusao';

interface OrigemData {
  tipoEntrada: string;
  tipoEntradaKey: TipoEntradaKey;
  consultor: string | null;
  dataCadastro: string | null;
  // Migração
  migracao: {
    associacaoOrigem: string | null;
    aprovadoEm: string | null;
    analistaNome: string | null;
    consultorNome: string | null;
    origemEntrada: string;
  } | null;
  // Indicação
  indicacao: {
    indicadorId: string;
    indicadorNome: string;
    dataConversao: string | null;
  } | null;
  // Reativação
  reativacao: {
    caminho: string | null;
    caminhoLabel: string;
    diasInadimplente: number | null;
    dataReativacao: string | null;
    consultorNome: string | null;
    novaCarencia: boolean;
    carenciaInicio: string | null;
    carenciaFim: string | null;
  } | null;
  // Troca titularidade
  trocaTitularidade: {
    cenario: string | null;
    cenarioLabel: string;
    titularAnterior: string | null;
    dataTroca: string | null;
    consultorNome: string | null;
    carenciaIsenta: boolean;
    carenciaInicio: string | null;
    carenciaFim: string | null;
  } | null;
  // Substituição de placa
  substituicaoPlaca: {
    placaAnterior: string | null;
    rastreadorDevolvido: boolean | null;
    dataSubstituicao: string | null;
    consultorNome: string | null;
  } | null;
  // Inclusão de veículo
  inclusao: {
    veiculoPrincipal: { placa: string; modelo: string; marca: string } | null;
    consultorNome: string | null;
    dataInclusao: string | null;
    carenciaInicio: string | null;
    carenciaFim: string | null;
  } | null;
  // Carência
  carencia: {
    isenta: boolean;
    motivoIsencao: string | null;
    inicio: string | null;
    fim: string | null;
  };
}

// ============================================
// HOOK
// ============================================

function useOrigemCadastro(associadoId: string) {
  return useQuery({
    queryKey: ['origem-cadastro', associadoId],
    queryFn: async (): Promise<OrigemData> => {
      // 1. Contract
      const { data: contrato } = await supabase
        .from('contratos')
        .select('id, created_at, vendedor_id, tipo_entrada, cotacao_id, carencia_isenta, carencia_motivo_isencao, data_carencia_inicio, data_carencia_fim, origem_troca_titularidade_id, veiculo_id, profiles:vendedor_id(nome)')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const tipoEntradaRaw = contrato?.tipo_entrada || null;
      const consultorNome = (contrato?.profiles as any)?.nome || null;

      // 2. Indicação
      const { data: indicacao } = await supabase
        .from('indicacoes')
        .select('id, indicador_id, data_conversao, associados!indicacoes_indicador_id_fkey(nome)')
        .eq('associado_id', associadoId)
        .eq('status', 'convertido')
        .maybeSingle();

      // Determine entry type key
      let tipoEntradaKey: TipoEntradaKey = 'adesao';
      if (tipoEntradaRaw === 'migracao') tipoEntradaKey = 'migracao';
      else if (tipoEntradaRaw === 'inclusao') tipoEntradaKey = 'inclusao';
      else if (tipoEntradaRaw === 'reativacao') tipoEntradaKey = 'reativacao';
      else if (tipoEntradaRaw === 'troca_titularidade') tipoEntradaKey = 'troca_titularidade';
      else if (tipoEntradaRaw === 'substituicao_placa') tipoEntradaKey = 'substituicao_placa';
      else if (indicacao) tipoEntradaKey = 'indicacao';

      // Fallback: check for approved direct migration by CPF when type is still 'adesao'
      if (tipoEntradaKey === 'adesao') {
        const { data: assocCpf } = await supabase
          .from('associados')
          .select('cpf')
          .eq('id', associadoId)
          .single();

        if (assocCpf?.cpf) {
          const { data: migDireta } = await supabase
            .from('solicitacoes_migracao')
            .select('id')
            .eq('associado_cpf', assocCpf.cpf)
            .eq('status', 'aprovada')
            .limit(1)
            .maybeSingle();

          if (migDireta) {
            tipoEntradaKey = 'migracao';
          }
        }
      }

      // Base result
      const result: OrigemData = {
        tipoEntrada: TIPO_ENTRADA_LABELS[tipoEntradaKey],
        tipoEntradaKey,
        consultor: consultorNome,
        dataCadastro: contrato?.created_at || null,
        migracao: null,
        indicacao: null,
        reativacao: null,
        trocaTitularidade: null,
        substituicaoPlaca: null,
        inclusao: null,
        carencia: {
          isenta: contrato?.carencia_isenta || false,
          motivoIsencao: contrato?.carencia_motivo_isencao || null,
          inicio: contrato?.data_carencia_inicio || null,
          fim: contrato?.data_carencia_fim || null,
        },
      };

      // Fetch type-specific data
      if (tipoEntradaKey === 'migracao') {
        let sol: any = null;

        // Try by cotacao_id first
        if (contrato?.cotacao_id) {
          const { data } = await supabase
            .from('solicitacoes_migracao')
            .select(`
              id, associacao_origem, aprovado_em, aprovado_por, consultor_id, status, origem_entrada,
              analista:profiles!solicitacoes_migracao_aprovado_por_fkey(nome),
              consultor:profiles!solicitacoes_migracao_consultor_id_fkey(nome)
            `)
            .eq('status', 'aprovada')
            .eq('cotacao_id', contrato.cotacao_id)
            .maybeSingle();
          sol = data;
        }

        // Fallback: search by CPF
        if (!sol) {
          const { data: assocCpf } = await supabase
            .from('associados')
            .select('cpf')
            .eq('id', associadoId)
            .single();

          if (assocCpf?.cpf) {
            const { data } = await supabase
              .from('solicitacoes_migracao')
              .select(`
                id, associacao_origem, aprovado_em, aprovado_por, consultor_id, status, origem_entrada,
                analista:profiles!solicitacoes_migracao_aprovado_por_fkey(nome),
                consultor:profiles!solicitacoes_migracao_consultor_id_fkey(nome)
              `)
              .eq('status', 'aprovada')
              .eq('associado_cpf', assocCpf.cpf)
              .order('aprovado_em', { ascending: false })
              .limit(1)
              .maybeSingle();
            sol = data;
          }
        }

        if (sol) {
          result.migracao = {
            associacaoOrigem: sol.associacao_origem,
            aprovadoEm: sol.aprovado_em,
            analistaNome: (sol.analista as any)?.nome || null,
            consultorNome: (sol.consultor as any)?.nome || null,
            origemEntrada: sol.origem_entrada || 'consultor',
          };
          result.tipoEntrada = result.migracao.origemEntrada === 'direta' ? 'Migração Direta' : 'Migração Aprovada';
        }
      }

      if (tipoEntradaKey === 'indicacao' && indicacao) {
        result.indicacao = {
          indicadorId: indicacao.indicador_id,
          indicadorNome: (indicacao.associados as any)?.nome || 'Associado',
          dataConversao: indicacao.data_conversao,
        };
      }

      if (tipoEntradaKey === 'reativacao') {
        const { data: hist } = await supabase
          .from('associados_historico')
          .select('created_at, dados_anteriores, dados_novos, descricao, usuario_id, metadata')
          .eq('associado_id', associadoId)
          .eq('tipo', 'status_alterado')
          .ilike('descricao', '%Reativação%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const dados = (hist?.dados_novos || hist?.dados_anteriores || hist?.metadata || {}) as any;
        const caminho = dados?.caminho || dados?.tipo_reativacao || null;
        const caminhoLabels: Record<string, string> = {
          '1': 'Simples',
          '2': 'Com revistoria',
          '3': 'Nova adesão completa',
          'simples': 'Simples',
          'revistoria': 'Com revistoria',
          'nova_adesao': 'Nova adesão completa',
        };

        result.reativacao = {
          caminho,
          caminhoLabel: caminho ? (caminhoLabels[String(caminho)] || String(caminho)) : 'Não informado',
          diasInadimplente: dados?.diasAtraso || dados?.dias_inadimplente || null,
          dataReativacao: hist?.created_at || null,
          consultorNome: consultorNome,
          novaCarencia: caminho === '3' || caminho === 'nova_adesao',
          carenciaInicio: contrato?.data_carencia_inicio || null,
          carenciaFim: contrato?.data_carencia_fim || null,
        };
      }

      if (tipoEntradaKey === 'troca_titularidade') {
        let titularAnterior: string | null = null;

        // Try to get previous owner from the origin contract
        if (contrato?.origem_troca_titularidade_id) {
          const { data: contratoAnterior } = await supabase
            .from('contratos')
            .select('associado_id, associados:associado_id(nome)')
            .eq('id', contrato.origem_troca_titularidade_id)
            .maybeSingle();
          titularAnterior = (contratoAnterior?.associados as any)?.nome || null;
        }

        // Try chat_solicitacoes_ia for scenario info
        const { data: solicitacao } = await supabase
          .from('chat_solicitacoes_ia')
          .select('dados, created_at, aprovado_em')
          .eq('associado_id', associadoId)
          .eq('tipo', 'troca_titularidade')
          .eq('status', 'aprovada')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const dados = (solicitacao?.dados || {}) as any;
        const cenario = dados?.cenario || dados?.scenario || null;
        const cenarioLabels: Record<string, string> = {
          'A': 'Cenário A — Vistoria dispensada',
          'B': 'Cenário B — Vistoria obrigatória',
          'a': 'Cenário A — Vistoria dispensada',
          'b': 'Cenário B — Vistoria obrigatória',
        };

        result.trocaTitularidade = {
          cenario,
          cenarioLabel: cenario ? (cenarioLabels[cenario] || `Cenário ${cenario}`) : 'Não informado',
          titularAnterior: titularAnterior || dados?.titular_anterior || null,
          dataTroca: solicitacao?.aprovado_em || solicitacao?.created_at || contrato?.created_at || null,
          consultorNome: consultorNome,
        };
      }

      if (tipoEntradaKey === 'substituicao_placa') {
        // Try chat_solicitacoes_ia
        const { data: solicitacao } = await supabase
          .from('chat_solicitacoes_ia')
          .select('dados, created_at, aprovado_em')
          .eq('associado_id', associadoId)
          .eq('tipo', 'substituicao_placa')
          .eq('status', 'aprovada')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const dados = (solicitacao?.dados || {}) as any;

        // Fallback: check associados_historico
        let placaAnterior = dados?.placa_anterior || null;
        let rastreadorDevolvido = dados?.rastreador_devolvido ?? null;

        if (!placaAnterior) {
          const { data: hist } = await supabase
            .from('associados_historico')
            .select('dados_anteriores, dados_novos, created_at')
            .eq('associado_id', associadoId)
            .ilike('descricao', '%substituição%placa%')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const histDados = (hist?.dados_anteriores || hist?.dados_novos || {}) as any;
          placaAnterior = histDados?.placa || histDados?.placa_anterior || null;
          if (rastreadorDevolvido === null) {
            rastreadorDevolvido = histDados?.rastreador_devolvido ?? null;
          }
        }

        result.substituicaoPlaca = {
          placaAnterior,
          rastreadorDevolvido,
          dataSubstituicao: solicitacao?.aprovado_em || solicitacao?.created_at || contrato?.created_at || null,
          consultorNome: consultorNome,
        };
      }

      if (tipoEntradaKey === 'inclusao') {
        // Buscar veículo principal (mais antigo do associado, diferente do veículo deste contrato)
        const { data: veiculoMaisAntigo } = await supabase
          .from('veiculos')
          .select('id, placa, modelo, marca')
          .eq('associado_id', associadoId)
          .neq('id', contrato?.veiculo_id || '')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        result.inclusao = {
          veiculoPrincipal: veiculoMaisAntigo
            ? { placa: veiculoMaisAntigo.placa || '', modelo: veiculoMaisAntigo.modelo || '', marca: veiculoMaisAntigo.marca || '' }
            : null,
          consultorNome: consultorNome,
          dataInclusao: contrato?.created_at || null,
          carenciaInicio: contrato?.data_carencia_inicio || null,
          carenciaFim: contrato?.data_carencia_fim || null,
        };
      }

      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================
// CONSTANTES
// ============================================

const TIPO_ENTRADA_LABELS: Record<TipoEntradaKey, string> = {
  adesao: 'Nova Adesão',
  migracao: 'Migração Aprovada',
  indicacao: 'Indicação',
  reativacao: 'Reativação',
  troca_titularidade: 'Troca de Titularidade',
  substituicao_placa: 'Substituição de Placa',
  inclusao: 'Inclusão de Veículo',
};

/** Labels curtos para uso em listagens */
export const TIPO_ENTRADA_SHORT_LABELS: Record<string, string> = {
  adesao: 'Nova Adesão',
  inclusao: 'Inclusão',
  migracao: 'Migração',
  substituicao_placa: 'Substituição',
  troca_titularidade: 'Troca Titular',
  reativacao: 'Reativação',
  indicacao: 'Indicação',
};

const BADGE_STYLES: Record<TipoEntradaKey, string> = {
  adesao: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  migracao: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400',
  indicacao: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  reativacao: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  troca_titularidade: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
  substituicao_placa: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  inclusao: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400',
};

const ICONS: Record<TipoEntradaKey, typeof UserPlus> = {
  adesao: UserPlus,
  migracao: Building2,
  indicacao: Users,
  reativacao: RefreshCw,
  troca_titularidade: ArrowRightLeft,
  substituicao_placa: Car,
  inclusao: Plus,
};

// ============================================
// UTILITÁRIOS
// ============================================

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ============================================
// SUB-RENDERS
// ============================================

function InfoField({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      <div className="text-xs font-medium mt-0.5">{value}</div>
    </div>
  );
}

function RenderNovaAdesao({ data }: { data: OrigemData }) {
  return (
    <>
      {data.consultor && <InfoField label="Consultor responsável" value={data.consultor} />}
      <InfoField label="Data do cadastro" value={formatDate(data.dataCadastro)} />
    </>
  );
}

function RenderMigracao({ data }: { data: OrigemData }) {
  const m = data.migracao;
  if (!m) return <RenderNovaAdesao data={data} />;

  return (
    <>
      {m.associacaoOrigem && (
        <InfoField label="Associação de origem" value={m.associacaoOrigem} icon={<Building2 className="h-3 w-3" />} />
      )}
      <InfoField label="Aprovação da migração" value={formatDateTime(m.aprovadoEm)} icon={<CalendarCheck className="h-3 w-3" />} />
      {m.analistaNome && <InfoField label="Analista responsável" value={m.analistaNome} />}
      {m.consultorNome && <InfoField label="Consultor solicitante" value={m.consultorNome} />}
    </>
  );
}

function RenderIndicacao({ data, canLink }: { data: OrigemData; canLink: boolean }) {
  const ind = data.indicacao;
  if (!ind) return <RenderNovaAdesao data={data} />;

  return (
    <>
      <InfoField
        label="Indicado por"
        value={
          canLink ? (
            <Link
              to={`/cadastro/associados/${ind.indicadorId}`}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {ind.indicadorNome}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            ind.indicadorNome
          )
        }
      />
      {data.consultor && <InfoField label="Consultor responsável" value={data.consultor} />}
      <InfoField label="Data da conversão" value={formatDate(ind.dataConversao || data.dataCadastro)} />
    </>
  );
}

function RenderReativacao({ data }: { data: OrigemData }) {
  const r = data.reativacao;
  if (!r) return <RenderNovaAdesao data={data} />;

  return (
    <>
      <InfoField label="Caminho aplicado" value={r.caminhoLabel} icon={<RefreshCw className="h-3 w-3" />} />
      {r.diasInadimplente != null && (
        <InfoField label="Dias inadimplente" value={`${r.diasInadimplente} dias`} />
      )}
      {r.consultorNome && <InfoField label="Consultor responsável" value={r.consultorNome} />}
      <InfoField label="Data da reativação" value={formatDate(r.dataReativacao)} />
      {r.novaCarencia && r.carenciaInicio && r.carenciaFim && (
        <div className="col-span-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Nova carência iniciada
          </span>
          <p className="text-xs font-medium mt-0.5">
            {formatDate(r.carenciaInicio)} a {formatDate(r.carenciaFim)}
          </p>
        </div>
      )}
    </>
  );
}

function RenderTrocaTitularidade({ data }: { data: OrigemData }) {
  const t = data.trocaTitularidade;
  if (!t) return <RenderNovaAdesao data={data} />;

  return (
    <>
      <InfoField label="Cenário aplicado" value={t.cenarioLabel} icon={<ArrowRightLeft className="h-3 w-3" />} />
      {t.titularAnterior && <InfoField label="Titular anterior" value={t.titularAnterior} />}
      {t.consultorNome && <InfoField label="Consultor responsável" value={t.consultorNome} />}
      <InfoField label="Data da troca" value={formatDate(t.dataTroca)} />
    </>
  );
}

function RenderSubstituicaoPlaca({ data }: { data: OrigemData }) {
  const s = data.substituicaoPlaca;
  if (!s) return <RenderNovaAdesao data={data} />;

  return (
    <>
      {s.placaAnterior && <InfoField label="Placa anterior" value={s.placaAnterior} icon={<Car className="h-3 w-3" />} />}
      {s.rastreadorDevolvido !== null && (
        <InfoField label="Rastreador devolvido" value={s.rastreadorDevolvido ? 'Sim' : 'Não'} />
      )}
      {s.consultorNome && <InfoField label="Consultor responsável" value={s.consultorNome} />}
      <InfoField label="Data da substituição" value={formatDate(s.dataSubstituicao)} />
    </>
  );
}

function RenderInclusao({ data }: { data: OrigemData }) {
  const inc = data.inclusao;
  if (!inc) return <RenderNovaAdesao data={data} />;

  return (
    <>
      {inc.veiculoPrincipal && (
        <InfoField
          label="Veículo principal"
          value={`${inc.veiculoPrincipal.marca} ${inc.veiculoPrincipal.modelo} — ${inc.veiculoPrincipal.placa}`}
          icon={<Car className="h-3 w-3" />}
        />
      )}
      {inc.consultorNome && <InfoField label="Consultor responsável" value={inc.consultorNome} />}
      <InfoField label="Data da inclusão" value={formatDate(inc.dataInclusao)} />
      {inc.carenciaInicio && inc.carenciaFim && (
        <div className="col-span-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Carência do veículo incluído (120 dias)
          </span>
          <p className="text-xs font-medium mt-0.5">
            {formatDate(inc.carenciaInicio)} a {formatDate(inc.carenciaFim)}
          </p>
        </div>
      )}
    </>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function OrigemCadastroCard({ associadoId, canLinkToAssociado = false }: Props) {
  const { data, isLoading } = useOrigemCadastro(associadoId);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!data) return null;

  const Icon = ICONS[data.tipoEntradaKey];
  const badgeStyle = BADGE_STYLES[data.tipoEntradaKey];

  const renderContent = () => {
    switch (data.tipoEntradaKey) {
      case 'migracao': return <RenderMigracao data={data} />;
      case 'indicacao': return <RenderIndicacao data={data} canLink={canLinkToAssociado} />;
      case 'reativacao': return <RenderReativacao data={data} />;
      case 'troca_titularidade': return <RenderTrocaTitularidade data={data} />;
      case 'substituicao_placa': return <RenderSubstituicaoPlaca data={data} />;
      case 'inclusao': return <RenderInclusao data={data} />;
      default: return <RenderNovaAdesao data={data} />;
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tipo de Entrada</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {/* Tipo de entrada */}
          <div>
            <span className="text-xs text-muted-foreground">Tipo de entrada</span>
            <div>
              <Badge variant="outline" className={`mt-0.5 text-xs ${badgeStyle}`}>
                {data.tipoEntrada}
              </Badge>
            </div>
          </div>

          {renderContent()}

          {/* Carência — show for migration, inclusão and reativação nova adesão */}
          {(data.tipoEntradaKey === 'migracao' || (data.tipoEntradaKey === 'reativacao' && !data.reativacao?.novaCarencia)) && (
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Situação de carência
              </span>
              {data.carencia.isenta ? (
                <p className="text-xs font-medium mt-0.5 text-emerald-600 dark:text-emerald-400">
                  Isento de carência — origem: {data.carencia.motivoIsencao || 'migração aprovada'}
                </p>
              ) : data.carencia.inicio && data.carencia.fim ? (
                <p className="text-xs font-medium mt-0.5">
                  {formatDate(data.carencia.inicio)} a {formatDate(data.carencia.fim)}
                </p>
              ) : (
                <p className="text-xs font-medium mt-0.5 text-muted-foreground">Período padrão</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
