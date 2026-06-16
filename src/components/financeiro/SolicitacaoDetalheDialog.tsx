import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, CheckCircle2, XCircle, Clock, FileText, ExternalLink,
  ThumbsUp, ThumbsDown, Wallet,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmpresas } from '@/hooks/useEmpresas';
import {
  SolicitacaoFinanceira,
  useAprovacoesSolicitacao,
  useRegistrarAprovacao,
  useCancelarSolicitacao,
  usePagarSolicitacao,
  SOLICITACAO_STATUS_CONFIG,
  SOLICITACAO_TIPO_LABEL,
  SOLICITACAO_CATEGORIAS,
  SOLICITACAO_SETORES,
  SOLICITACAO_PRIORIDADE_CONFIG,
} from '@/hooks/useSolicitacoesFinanceiras';

interface Props {
  solicitacao: SolicitacaoFinanceira | null;
  open: boolean;
  onClose: () => void;
}

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatData = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export function SolicitacaoDetalheDialog({ solicitacao, open, onClose }: Props) {
  const { profile } = useAuth();
  const permissions = usePermissions();
  const { data: aprovacoes = [] } = useAprovacoesSolicitacao(solicitacao?.id ?? null);
  const { data: empresas = [] } = useEmpresas();
  const { data: socios = [] } = useQuery({
    queryKey: ['socios-lista'],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await (supabase as any).rpc('listar_socios');
      if (error) throw error;
      return data ?? [];
    },
  });

  const registrar = useRegistrarAprovacao();
  const cancelar = useCancelarSolicitacao();
  const pagar = usePagarSolicitacao();

  const [comentario, setComentario] = useState('');

  if (!solicitacao) return null;

  const status = SOLICITACAO_STATUS_CONFIG[solicitacao.status];
  const categoriaLabel =
    SOLICITACAO_CATEGORIAS.find((c) => c.value === solicitacao.categoria)?.label ?? solicitacao.categoria;
  const setorLabel =
    SOLICITACAO_SETORES.find((s) => s.value === solicitacao.setor)?.label ?? (solicitacao.setor || '—');
  const prioridade = SOLICITACAO_PRIORIDADE_CONFIG[solicitacao.prioridade];
  const empresaNome = empresas.find((e) => e.id === solicitacao.empresa_id)?.nome ?? '—';

  // Lista de liberações por sócio (mostra quem liberou, rejeitou ou ainda está pendente)
  const listaLiberacoes = socios.length > 0
    ? socios.map((soc) => {
        const v = aprovacoes.find((a) => a.socio_id === soc.id);
        return { id: soc.id, nome: soc.nome, decisao: v?.decisao, created_at: v?.created_at, comentario: v?.comentario };
      })
    : aprovacoes.map((a) => ({
        id: a.id, nome: a.socio_nome || 'Sócio', decisao: a.decisao, created_at: a.created_at, comentario: a.comentario,
      }));

  const isSocio = permissions.isSocio;
  const podePagar =
    permissions.isGerencia || permissions.isDiretor || permissions.canManageContabilidade || permissions.isAdminMaster;
  const ehDono = !!profile?.id && (solicitacao.criado_por === profile.id || solicitacao.solicitante_id === profile.id);

  const meuVoto = aprovacoes.find((a) => a.socio_id === profile?.id);
  const emAndamento = registrar.isPending || cancelar.isPending || pagar.isPending;

  const handleVoto = (decisao: 'aprovado' | 'rejeitado') => {
    if (!profile?.id) return;
    registrar.mutate({
      solicitacaoId: solicitacao.id,
      socioId: profile.id,
      socioNome: profile.nome,
      decisao,
      comentario: comentario.trim() || undefined,
    });
    setComentario('');
  };

  const handlePagar = () => {
    pagar.mutate(
      { solicitacao, pagoPor: profile?.id ?? null },
      { onSuccess: () => onClose() },
    );
  };

  const handleCancelar = () => {
    cancelar.mutate(solicitacao.id, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {SOLICITACAO_TIPO_LABEL[solicitacao.tipo] || solicitacao.tipo}
            <Badge variant={status?.variant || 'secondary'}>{status?.label || solicitacao.status}</Badge>
            {prioridade && <Badge variant={prioridade.variant}>{prioridade.label}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Resumo */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{formatBRL(solicitacao.valor)}</span>
              <span className="text-muted-foreground">{categoriaLabel}</span>
            </div>
            <p>{solicitacao.descricao}</p>
            <Separator />
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <span>Solicitante:</span><span className="text-foreground">{solicitacao.solicitante_nome}</span>
              <span>Setor:</span><span className="text-foreground">{setorLabel}</span>
              <span>Empresa:</span><span className="text-foreground">{empresaNome}</span>
              <span>Favorecido:</span><span className="text-foreground">{solicitacao.favorecido_nome || solicitacao.solicitante_nome}</span>
              {solicitacao.numero_documento && (
                <>
                  <span>NF / Documento:</span><span className="text-foreground">{solicitacao.numero_documento}</span>
                </>
              )}
              <span>Vencimento:</span><span className="text-foreground">{formatData(solicitacao.data_vencimento || solicitacao.data_necessidade)}</span>
              <span>Criada em:</span><span className="text-foreground">{formatData(solicitacao.created_at)}</span>
            </div>
            {solicitacao.observacao && (
              <p className="text-muted-foreground text-xs pt-1">Obs.: {solicitacao.observacao}</p>
            )}
            {solicitacao.comprovante_url && (
              <a
                href={solicitacao.comprovante_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline pt-1"
              >
                <FileText className="h-4 w-4" /> Ver comprovante <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Liberações dos sócios */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Liberações dos sócios</h4>
              <span className="text-muted-foreground text-xs">
                {solicitacao.aprovacoes_count}/{solicitacao.aprovacoes_necessarias} aprovações
              </span>
            </div>
            {listaLiberacoes.length === 0 && (
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Aguardando liberação dos sócios.
              </p>
            )}
            {listaLiberacoes.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                {item.decisao === 'aprovado' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : item.decisao === 'rejeitado' ? (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-medium">{item.nome}</span>{' '}
                  <span className="text-muted-foreground text-xs">
                    {item.decisao === 'aprovado'
                      ? `liberou · ${formatData(item.created_at)}`
                      : item.decisao === 'rejeitado'
                        ? `rejeitou · ${formatData(item.created_at)}`
                        : 'aguardando liberação'}
                  </span>
                  {item.comentario && <p className="text-muted-foreground text-xs">{item.comentario}</p>}
                </div>
              </div>
            ))}
            {solicitacao.status === 'rejeitado' && solicitacao.motivo_rejeicao && (
              <p className="text-destructive text-xs">Motivo: {solicitacao.motivo_rejeicao}</p>
            )}
          </div>

          {/* Ações do sócio */}
          {isSocio && ['pendente', 'aprovado'].includes(solicitacao.status) && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">
                {meuVoto ? 'Você já registrou um voto — pode alterá-lo abaixo.' : 'Sua liberação como sócio'}
              </Label>
              <Textarea
                placeholder="Comentário (opcional)"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={emAndamento}
                  onClick={() => handleVoto('aprovado')}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" /> Liberar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={emAndamento}
                  onClick={() => handleVoto('rejeitado')}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" /> Rejeitar
                </Button>
              </div>
            </div>
          )}

          {/* Ação do financeiro: pagar */}
          {podePagar && solicitacao.status === 'aprovado' && (
            <Button className="w-full" disabled={emAndamento} onClick={handlePagar}>
              {pagar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              Efetuar pagamento (gera Conta a Pagar)
            </Button>
          )}

          {solicitacao.status === 'pago' && (
            <p className="text-green-600 flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-4 w-4" /> Pago em {formatData(solicitacao.pago_em)} — lançado em Contas a Pagar.
            </p>
          )}

          {/* Cancelar */}
          {(podePagar || ehDono) && solicitacao.status === 'pendente' && (
            <Button variant="outline" className="w-full" disabled={emAndamento} onClick={handleCancelar}>
              Cancelar solicitação
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Label local simples (evita import extra)
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={className}>{children}</p>;
}
