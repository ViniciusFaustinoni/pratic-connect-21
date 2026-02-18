import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Package, Phone, MessageCircle, Loader2, Truck,
  CheckCircle, Clock, Wrench, Car, Building2,
} from 'lucide-react';
import { useVistoriaEvento } from '@/hooks/useVistoriaEvento';

interface PecaStatus {
  descricao: string;
  chegou: boolean;
  chegou_em: string | null;
}

interface CardControleReparoProps {
  sinistro: any;
  onOpenAtribuirFornecedores: () => void;
}

export function CardControleReparo({ sinistro, onOpenAtribuirFornecedores }: CardControleReparoProps) {
  const queryClient = useQueryClient();
  const { data: vistoria } = useVistoriaEvento(sinistro.id);

  // Buscar cotações aprovadas com dados do auto center
  const { data: cotacaoAprovada } = useQuery({
    queryKey: ['cotacoes-aprovadas', sinistro.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evento_cotacoes_pecas')
        .select('id, itens, valor_total, status, auto_center_id')
        .eq('sinistro_id', sinistro.id)
        .eq('status', 'aprovada')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Buscar auto center separadamente
      const { data: autoCenter } = await supabase
        .from('auto_centers')
        .select('id, nome, contato_telefone, whatsapp')
        .eq('id', data.auto_center_id)
        .single();

      return { ...data, autoCenter };
    },
    enabled: ['pecas_em_cotacao', 'em_reparo'].includes(sinistro.status),
  });

  // Buscar chamado de assistência vinculado ao sinistro
  const { data: chamadoGuncho } = useQuery({
    queryKey: ['chamado-guncho-sinistro', sinistro.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('chamados_assistencia')
        .select('id, status, protocolo, prestador_nome, prestador_telefone') as any)
        .eq('sinistro_id', sinistro.id)
        .eq('tipo_servico', 'guincho')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: sinistro.status === 'em_reparo',
    refetchInterval: sinistro.status === 'em_reparo' ? 10000 : false,
  });

  // Buscar oficina atribuída
  const { data: oficina } = useQuery({
    queryKey: ['oficina-sinistro', sinistro.oficina_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oficinas')
        .select('id, nome_fantasia, telefone, whatsapp, cidade, estado')
        .eq('id', sinistro.oficina_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sinistro.oficina_id,
  });

  // Peças do orçamento
  const pecasOrcamento = vistoria?.dados_vistoria?.itens_orcamento?.filter(
    (item: any) => item.tipo === 'peca'
  ) || [];

  const pecasStatus: PecaStatus[] = Array.isArray((sinistro as any).pecas_status)
    ? (sinistro as any).pecas_status
    : [];
  const pedidoRealizado = (sinistro as any).pecas_pedido_realizado === true;

  // Mutation: marcar pedido como realizado
  const marcarPedidoMutation = useMutation({
    mutationFn: async () => {
      const initialStatus: PecaStatus[] = pecasOrcamento.map((p: any) => ({
        descricao: p.descricao,
        chegou: false,
        chegou_em: null,
      }));
      const { error } = await supabase
        .from('sinistros')
        .update({ pecas_pedido_realizado: true, pecas_status: initialStatus as any })
        .eq('id', sinistro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
      toast.success('Pedido marcado como realizado!');
    },
    onError: () => toast.error('Erro ao atualizar status do pedido'),
  });

  // Mutation: marcar peça como chegou
  const marcarPecaChegouMutation = useMutation({
    mutationFn: async ({ index, chegou }: { index: number; chegou: boolean }) => {
      const updated = [...pecasStatus];
      updated[index] = {
        ...updated[index],
        chegou,
        chegou_em: chegou ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from('sinistros')
        .update({ pecas_status: updated as any })
        .eq('id', sinistro.id);
      if (error) throw error;

      const todasChegaram = updated.every(p => p.chegou);
      if (todasChegaram && chegou) {
        const telefone = sinistro.associado?.whatsapp || sinistro.associado?.telefone;
        if (telefone) {
          await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone,
              mensagem: `Olá, *${sinistro.associado?.nome || ''}*! 🎉\n\nInformamos que *todas as peças* do seu evento (protocolo *${sinistro.protocolo}*) *já chegaram*!\n\nEm breve entraremos em contato para agendar a remoção do veículo até a oficina.\n\nQualquer dúvida, estamos à disposição.`,
            },
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
    },
    onError: () => toast.error('Erro ao atualizar status da peça'),
  });

  // Mutation: enviar para oficina
  const enviarParaOficinaMutation = useMutation({
    mutationFn: async () => {
      if (!sinistro.oficina_id || !oficina) throw new Error('Oficina não atribuída');

      const { error: chamadoError } = await supabase
        .from('chamados_assistencia')
        .insert({
          tipo_servico: 'guincho',
          veiculo_id: sinistro.veiculo_id,
          associado_id: sinistro.associado_id,
          sinistro_id: sinistro.id,
          descricao: `Remoção do veículo para oficina ${oficina.nome_fantasia} - Sinistro ${sinistro.protocolo}`,
          destino_endereco: `${oficina.nome_fantasia} - ${oficina.cidade || ''}/${oficina.estado || ''}`,
          status: 'aberto',
        } as any);
      if (chamadoError) throw chamadoError;

      const { error: sinistroError } = await supabase
        .from('sinistros')
        .update({ status: 'em_reparo' })
        .eq('id', sinistro.id);
      if (sinistroError) throw sinistroError;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        usuario_id: user?.id,
        acao: 'enviar_para_oficina',
        descricao: `Veículo enviado para oficina ${oficina.nome_fantasia}. Chamado de guincho criado.`,
        status_anterior: sinistro.status,
        status_novo: 'em_reparo',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
      queryClient.invalidateQueries({ queryKey: ['chamados-assistencia'] });
      toast.success('Chamado de guincho criado! Veículo será removido para a oficina.');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  // Notificar quando chamado de guincho for concluído
  useEffect(() => {
    if (chamadoGuncho?.status === 'concluido') {
      const notifyKey = `notified-guncho-${chamadoGuncho.id}`;
      if (!sessionStorage.getItem(notifyKey)) {
        sessionStorage.setItem(notifyKey, 'true');
        const telefone = sinistro.associado?.whatsapp || sinistro.associado?.telefone;
        if (telefone) {
          supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone,
              mensagem: `Olá, *${sinistro.associado?.nome || ''}*! 🔧\n\nInformamos que o seu veículo *já se encontra na oficina* e o *reparo será iniciado*.\n\nProtocolo: *${sinistro.protocolo}*\n\nVocê receberá atualizações sobre o andamento. Qualquer dúvida, estamos à disposição!`,
            },
          });
        }
      }
    }
  }, [chamadoGuncho?.status, chamadoGuncho?.id, sinistro.associado, sinistro.protocolo]);

  const todasPecasChegaram = pecasStatus.length > 0 && pecasStatus.every(p => p.chegou);

  const isAprovadoCotaPaga = sinistro.status === 'aprovado' && (sinistro as any).cota_paga === true;
  const isPecasEmCotacao = sinistro.status === 'pecas_em_cotacao';
  const isEmReparo = sinistro.status === 'em_reparo';

  if (!isAprovadoCotaPaga && !isPecasEmCotacao && !isEmReparo) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-5 w-5" />
          Controle do Reparo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fase 1: Pedido de Peças */}
        {isAprovadoCotaPaga && !isPecasEmCotacao && !isEmReparo && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cota paga e termo assinado. Inicie o pedido das peças.
            </p>
            <Button className="w-full" onClick={onOpenAtribuirFornecedores}>
              <Package className="h-4 w-4 mr-2" />
              Fazer Pedidos das Peças
            </Button>
          </div>
        )}

        {/* Fase 2: Peças em Cotação */}
        {isPecasEmCotacao && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">Peças do Orçamento</p>
              {pecasOrcamento.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma peça encontrada no orçamento.</p>
              )}
              {pecasOrcamento.map((peca: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{peca.descricao}</p>
                    {peca.quantidade > 1 && (
                      <p className="text-xs text-muted-foreground">Qtd: {peca.quantidade}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Fornecedor aprovado */}
            {cotacaoAprovada?.autoCenter && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Fornecedor: {cotacaoAprovada.autoCenter.nome}
                  </p>
                  <div className="flex gap-2">
                    {cotacaoAprovada.autoCenter.contato_telefone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${cotacaoAprovada.autoCenter!.contato_telefone}`, '_self')}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Ligar
                      </Button>
                    )}
                    {cotacaoAprovada.autoCenter.whatsapp && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const cleaned = (cotacaoAprovada.autoCenter!.whatsapp || '').replace(/\D/g, '');
                          window.open(`https://wa.me/55${cleaned}`, '_blank');
                        }}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Marcar pedido como realizado */}
            {!pedidoRealizado ? (
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => marcarPedidoMutation.mutate()}
                disabled={marcarPedidoMutation.isPending}
              >
                {marcarPedidoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Marcar Pedido como Realizado
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700">Pedido Realizado</p>
                </div>

                <p className="text-sm text-muted-foreground">Marque conforme cada peça chegar:</p>
                {pecasStatus.map((peca, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
                    <Checkbox
                      checked={peca.chegou}
                      onCheckedChange={(checked) => {
                        marcarPecaChegouMutation.mutate({ index: i, chegou: !!checked });
                      }}
                      disabled={marcarPecaChegouMutation.isPending}
                    />
                    <div className="flex-1">
                      <p className="text-sm">{peca.descricao}</p>
                      {peca.chegou && peca.chegou_em && (
                        <p className="text-xs text-muted-foreground">
                          Chegou em {new Date(peca.chegou_em).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    {peca.chegou && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                  </div>
                ))}

                {todasPecasChegaram && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Badge variant="secondary" className="w-full justify-center py-1">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Todas as peças chegaram!
                      </Badge>
                      <Button
                        className="w-full"
                        onClick={() => enviarParaOficinaMutation.mutate()}
                        disabled={enviarParaOficinaMutation.isPending || !sinistro.oficina_id}
                      >
                        {enviarParaOficinaMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Truck className="h-4 w-4 mr-2" />
                        )}
                        Enviar para Oficina
                      </Button>
                      {!sinistro.oficina_id && (
                        <p className="text-xs text-destructive text-center">
                          Oficina não atribuída. Atribua uma oficina primeiro.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fase 4/5: Em Reparo */}
        {isEmReparo && (
          <div className="space-y-3">
            {sinistro.veiculo && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4" />
                <span className="font-medium">
                  {sinistro.veiculo.marca} {sinistro.veiculo.modelo} - {sinistro.veiculo.placa}
                </span>
              </div>
            )}

            {oficina && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" />
                <span>{oficina.nome_fantasia}</span>
              </div>
            )}

            {chamadoGuncho?.status === 'concluido' ? (
              <Badge variant="secondary" className="w-full justify-center py-1.5">
                <CheckCircle className="h-3 w-3 mr-1" />
                Veículo na Oficina
              </Badge>
            ) : (
              <Badge variant="outline" className="w-full justify-center py-1.5 border-amber-300 text-amber-700">
                <Clock className="h-3 w-3 mr-1" />
                Pendente de Remoção para Oficina
              </Badge>
            )}

            {chamadoGuncho && (
              <p className="text-xs text-muted-foreground text-center">
                Chamado: {chamadoGuncho.protocolo || chamadoGuncho.id?.slice(0, 8)}
                {chamadoGuncho.prestador_nome && ` • ${chamadoGuncho.prestador_nome}`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
