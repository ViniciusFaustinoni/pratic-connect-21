import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { UserPlus, ExternalLink, ShieldCheck, Building2, CalendarCheck } from 'lucide-react';

interface Props {
  associadoId: string;
}

function useOrigemCadastro(associadoId: string) {
  return useQuery({
    queryKey: ['origem-cadastro', associadoId],
    queryFn: async () => {
      // Check if this associate was referred
      const { data: indicacao } = await supabase
        .from('indicacoes')
        .select('id, indicador_id, data_conversao, associados!indicacoes_indicador_id_fkey(nome)')
        .eq('associado_id', associadoId)
        .eq('status', 'convertido')
        .maybeSingle();

      // Get contract info with carência fields
      const { data: contrato } = await supabase
        .from('contratos')
        .select('id, created_at, vendedor_id, tipo_entrada, cotacao_id, carencia_isenta, carencia_motivo_isencao, data_carencia_inicio, data_carencia_fim, profiles:vendedor_id(nome)')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If migration, fetch solicitação details
      let migracao = null;
      if (contrato?.tipo_entrada === 'migracao') {
        // Try by cotacao_id first, then by CPF for direct entries
        let solicitacaoQuery = supabase
          .from('solicitacoes_migracao')
          .select(`
            id,
            associacao_origem,
            aprovado_em,
            aprovado_por,
            consultor_id,
            status,
            origem_entrada,
            analista:profiles!solicitacoes_migracao_aprovado_por_fkey(nome),
            consultor:profiles!solicitacoes_migracao_consultor_id_fkey(nome)
          `)
          .eq('status', 'aprovada');

        if (contrato.cotacao_id) {
          solicitacaoQuery = solicitacaoQuery.eq('cotacao_id', contrato.cotacao_id);
        }

        const { data: solicitacao } = await solicitacaoQuery.maybeSingle();

        if (solicitacao) {
          migracao = {
            associacaoOrigem: (solicitacao as any).associacao_origem,
            aprovadoEm: (solicitacao as any).aprovado_em,
            analistaNome: (solicitacao.analista as any)?.nome || null,
            consultorNome: (solicitacao.consultor as any)?.nome || null,
            origemEntrada: (solicitacao as any).origem_entrada || 'consultor',
          };
        }
      }

      // Determine entry type
      let tipoEntrada = 'Nova adesão';
      if (contrato?.tipo_entrada === 'migracao') {
        tipoEntrada = migracao ? 'Migração Aprovada' : 'Migração';
      } else if (contrato?.tipo_entrada === 'reativacao') {
        tipoEntrada = 'Reativação';
      } else if (indicacao) {
        tipoEntrada = 'Indicação';
      }

      return {
        tipoEntrada,
        tipoEntradaRaw: contrato?.tipo_entrada || null,
        indicacao: indicacao ? {
          indicadorId: indicacao.indicador_id,
          indicadorNome: (indicacao.associados as any)?.nome || 'Associado',
          dataConversao: indicacao.data_conversao,
        } : null,
        consultor: (contrato?.profiles as any)?.nome || null,
        dataConversao: indicacao?.data_conversao || contrato?.created_at || null,
        migracao,
        carencia: {
          isenta: contrato?.carencia_isenta || false,
          motivoIsencao: contrato?.carencia_motivo_isencao || null,
          inicio: contrato?.data_carencia_inicio || null,
          fim: contrato?.data_carencia_fim || null,
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function OrigemCadastroCard({ associadoId }: Props) {
  const { data, isLoading } = useOrigemCadastro(associadoId);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!data) return null;

  const isMigracao = data.tipoEntradaRaw === 'migracao';
  const badgeVariant = isMigracao && data.migracao ? 'default' : 'outline';
  const badgeClass = isMigracao && data.migracao
    ? 'bg-success/20 text-success border-success'
    : '';

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Origem do Cadastro</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {/* Tipo de entrada */}
          <div>
            <span className="text-xs text-muted-foreground">Tipo de entrada</span>
            <div>
              <Badge variant={badgeVariant} className={`mt-0.5 text-xs ${badgeClass}`}>
                {data.tipoEntrada}
              </Badge>
            </div>
          </div>

          {/* Indicação */}
          {data.indicacao && (
            <div>
              <span className="text-xs text-muted-foreground">Indicado por</span>
              <div>
                <Link
                  to={`/cadastro/associados/${data.indicacao.indicadorId}`}
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  {data.indicacao.indicadorNome}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Migração: Associação de origem */}
          {isMigracao && data.migracao && (
            <div>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Associação de origem
              </span>
              <p className="text-xs font-medium mt-0.5">{data.migracao.associacaoOrigem}</p>
            </div>
          )}

          {/* Migração: Data de aprovação */}
          {isMigracao && data.migracao && (
            <div>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarCheck className="h-3 w-3" />
                Aprovação da migração
              </span>
              <p className="text-xs font-medium mt-0.5">{formatDateTime(data.migracao.aprovadoEm)}</p>
            </div>
          )}

          {/* Migração: Analista */}
          {isMigracao && data.migracao?.analistaNome && (
            <div>
              <span className="text-xs text-muted-foreground">Analista responsável</span>
              <p className="text-xs font-medium mt-0.5">{data.migracao.analistaNome}</p>
            </div>
          )}

          {/* Migração: Consultor */}
          {isMigracao && data.migracao?.consultorNome && (
            <div>
              <span className="text-xs text-muted-foreground">Consultor solicitante</span>
              <p className="text-xs font-medium mt-0.5">{data.migracao.consultorNome}</p>
            </div>
          )}

          {/* Consultor (non-migration) */}
          {!isMigracao && data.consultor && (
            <div>
              <span className="text-xs text-muted-foreground">Consultor responsável</span>
              <p className="text-xs font-medium mt-0.5">{data.consultor}</p>
            </div>
          )}

          {data.dataConversao && !isMigracao && (
            <div>
              <span className="text-xs text-muted-foreground">Data da conversão</span>
              <p className="text-xs font-medium mt-0.5">{formatDate(data.dataConversao)}</p>
            </div>
          )}

          {/* Carência */}
          <div className="col-span-2">
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Situação de carência
            </span>
            {data.carencia.isenta ? (
              <p className="text-xs font-medium mt-0.5 text-success">
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
        </div>
      </CardContent>
    </Card>
  );
}
