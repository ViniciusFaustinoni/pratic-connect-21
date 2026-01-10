import { useState } from 'react';
import { Clock, Check, X, AlertCircle, User, Shield, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Solicitacao {
  id: string;
  tipo: string;
  solicitante_id: string;
  usuario_alvo_id: string | null;
  perfil_alvo: string | null;
  dados: Record<string, unknown> | null;
  status: string;
  motivo: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  expira_em: string;
  aprovador_id: string | null;
  aprovado_em: string | null;
}

const tipoLabels: Record<string, string> = {
  alterar_permissao: 'Alterar Permissão',
  adicionar_perfil: 'Adicionar Perfil',
  remover_perfil: 'Remover Perfil',
  criar_role: 'Criar Nova Role',
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: 'Pendente', color: 'bg-amber-500/20 text-amber-400', icon: <Clock className="w-3 h-3" /> },
  aprovado: { label: 'Aprovado', color: 'bg-green-500/20 text-green-400', icon: <Check className="w-3 h-3" /> },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-500/20 text-red-400', icon: <X className="w-3 h-3" /> },
  expirado: { label: 'Expirado', color: 'bg-gray-500/20 text-gray-400', icon: <AlertCircle className="w-3 h-3" /> },
};

export function SolicitacoesTab() {
  const queryClient = useQueryClient();
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [actionType, setActionType] = useState<'aprovar' | 'rejeitar' | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  // Buscar solicitações pendentes
  const { data: solicitacoes, isLoading, refetch } = useQuery({
    queryKey: ['solicitacoes-permissao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_permissao')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Solicitacao[];
    },
  });

  // Mutation para aprovar/rejeitar
  const updateSolicitacao = useMutation({
    mutationFn: async ({ id, status, motivo_rejeicao }: { id: string; status: string; motivo_rejeicao?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('solicitacoes_permissao')
        .update({
          status,
          aprovador_id: user?.id,
          aprovado_em: new Date().toISOString(),
          motivo_rejeicao: motivo_rejeicao || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-permissao'] });
      toast.success(variables.status === 'aprovado' ? 'Solicitação aprovada!' : 'Solicitação rejeitada.');
      setSelectedSolicitacao(null);
      setActionType(null);
      setMotivoRejeicao('');
    },
    onError: (error) => {
      toast.error('Erro ao processar solicitação: ' + error.message);
    },
  });

  const handleAction = (solicitacao: Solicitacao, type: 'aprovar' | 'rejeitar') => {
    setSelectedSolicitacao(solicitacao);
    setActionType(type);
  };

  const confirmAction = () => {
    if (!selectedSolicitacao || !actionType) return;

    if (actionType === 'aprovar') {
      updateSolicitacao.mutate({ id: selectedSolicitacao.id, status: 'aprovado' });
    } else {
      updateSolicitacao.mutate({ 
        id: selectedSolicitacao.id, 
        status: 'rejeitado',
        motivo_rejeicao: motivoRejeicao 
      });
    }
  };

  const pendentes = solicitacoes?.filter(s => s.status === 'pendente') || [];
  const historico = solicitacoes?.filter(s => s.status !== 'pendente') || [];

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Carregando solicitações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Solicitações Pendentes */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Solicitações Pendentes
              {pendentes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendentes.length}
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <div className="text-center py-8">
              <Check className="w-12 h-12 mx-auto text-green-500/50" />
              <p className="mt-2 text-muted-foreground">Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendentes.map((solicitacao) => (
                <div 
                  key={solicitacao.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={statusConfig[solicitacao.status].color}>
                        {statusConfig[solicitacao.status].icon}
                        <span className="ml-1">{tipoLabels[solicitacao.tipo]}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(solicitacao.created_at), { 
                          addSuffix: true,
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    {solicitacao.perfil_alvo && (
                      <p className="text-sm text-foreground">
                        Perfil: <strong>{solicitacao.perfil_alvo}</strong>
                      </p>
                    )}
                    {solicitacao.motivo && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Motivo: {solicitacao.motivo}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Expira em: {format(new Date(solicitacao.expira_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleAction(solicitacao, 'rejeitar')}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleAction(solicitacao, 'aprovar')}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      {historico.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historico.slice(0, 10).map((solicitacao) => (
                <div 
                  key={solicitacao.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={statusConfig[solicitacao.status].color}>
                      {statusConfig[solicitacao.status].icon}
                      <span className="ml-1">{statusConfig[solicitacao.status].label}</span>
                    </Badge>
                    <div>
                      <p className="text-sm text-foreground">{tipoLabels[solicitacao.tipo]}</p>
                      {solicitacao.perfil_alvo && (
                        <p className="text-xs text-muted-foreground">Perfil: {solicitacao.perfil_alvo}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(solicitacao.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmação */}
      <AlertDialog open={!!selectedSolicitacao && !!actionType} onOpenChange={() => {
        setSelectedSolicitacao(null);
        setActionType(null);
        setMotivoRejeicao('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'aprovar' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'aprovar' 
                ? 'Tem certeza que deseja aprovar esta solicitação? A alteração será aplicada imediatamente.'
                : 'Tem certeza que deseja rejeitar esta solicitação?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>

          {actionType === 'rejeitar' && (
            <div className="space-y-2 py-4">
              <Label htmlFor="motivo">Motivo da rejeição (opcional)</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da rejeição..."
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionType === 'aprovar' ? 'Aprovar' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
