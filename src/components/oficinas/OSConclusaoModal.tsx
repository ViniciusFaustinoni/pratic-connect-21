import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Phone, Mail, MessageCircle, Copy, Send,
  CheckCircle, FileSignature, ExternalLink, Car, User, Building2
} from 'lucide-react';
import { useUpdateOSStatus } from '@/hooks/useOrdensServico';

interface OSConclusaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  os: any;
}

export function OSConclusaoModal({ open, onOpenChange, os }: OSConclusaoModalProps) {
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOSStatus();
  const [step, setStep] = useState<'confirm' | 'signature'>('confirm');
  const [concluding, setConcluding] = useState(false);
  const [sendingTermo, setSendingTermo] = useState(false);
  const [signatureLink, setSignatureLink] = useState<string | null>(os?.autentique_url || null);
  const [assinado, setAssinado] = useState(os?.termo_saida_assinado || false);
  const [liberando, setLiberando] = useState(false);

  // Sync with os data
  useEffect(() => {
    if (os?.autentique_url) {
      setSignatureLink(os.autentique_url);
      setStep('signature');
    }
    if (os?.termo_saida_assinado) {
      setAssinado(true);
    }
  }, [os]);

  // Polling for signature status
  useEffect(() => {
    if (!signatureLink || assinado || !open) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('ordens_servico')
        .select('termo_saida_assinado, termo_saida_assinado_em, termo_saida_url' as any)
        .eq('id', os.id)
        .single();

      if ((data as any)?.termo_saida_assinado) {
        setAssinado(true);
        queryClient.invalidateQueries({ queryKey: ['ordem_servico', os.id] });
        toast.success('Termo assinado! Veículo liberado.');
        clearInterval(interval);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [signatureLink, assinado, open, os?.id, queryClient]);

  const associado = os?.associado;
  const veiculo = os?.veiculo;
  const oficina = os?.oficina;

  const handleConcluir = async () => {
    setConcluding(true);
    try {
      // 1. Atualizar status para concluído
      await updateStatus.mutateAsync({
        id: os.id,
        status: 'concluido',
        observacao: 'OS concluída - Veículo pronto para retirada',
      });

      // 2. Enviar WhatsApp ao associado
      if (associado?.whatsapp || associado?.telefone) {
        const phone = associado.whatsapp || associado.telefone;
        const oficinaNome = oficina?.nome_fantasia || oficina?.razao_social || 'oficina';
        const veiculoDesc = veiculo ? `*${veiculo.marca} ${veiculo.modelo}* placa *${veiculo.placa}*` : 'seu veículo';

        // Montar endereço da oficina
        const enderecoPartes = [
          oficina?.logradouro || oficina?.endereco,
          oficina?.numero,
          oficina?.bairro,
          oficina?.cidade,
          oficina?.uf || oficina?.estado,
        ].filter(Boolean);
        const enderecoTexto = enderecoPartes.length > 0 ? enderecoPartes.join(', ') : '';

        let mensagem = `Olá *${associado.nome}*! 🚗\n\n` +
          `Informamos que o reparo do seu veículo ${veiculoDesc} foi *concluído com sucesso*!\n\n` +
          `📍 *Por favor, compareça na oficina para retirar seu veículo:*\n` +
          `🏪 *${oficinaNome}*\n`;

        if (enderecoTexto) {
          mensagem += `📌 Endereço: ${enderecoTexto}\n`;
        }

        mensagem += `\n📝 Você receberá um *Termo de Saída* para assinatura digital antes da liberação do veículo.\n\n` +
          `Em caso de dúvidas, entre em contato conosco.\n\n` +
          `*ABP PraticCar*`;

        console.log('[OSConclusao] Enviando WhatsApp:', { telefone: phone, associado: associado.nome, oficina: oficinaNome, endereco: enderecoTexto });

        try {
          const { data, error: whatsError } = await supabase.functions.invoke('whatsapp-send-text', {
            body: { telefone: phone.replace(/\D/g, ''), mensagem },
          });
          console.log('[OSConclusao] Resposta WhatsApp:', { data, error: whatsError });
          if (whatsError) {
            toast.warning('Não foi possível enviar WhatsApp ao associado');
          } else {
            toast.success('Mensagem enviada ao associado via WhatsApp');
          }
        } catch (whatsErr) {
          console.error('[OSConclusao] Erro ao enviar WhatsApp:', whatsErr);
          toast.warning('Não foi possível enviar WhatsApp ao associado');
        }
      } else {
        console.warn('[OSConclusao] Associado sem telefone/whatsapp:', associado);
      }

      setStep('signature');
    } catch (error) {
      console.error('[OSConclusao] Erro ao concluir:', error);
    } finally {
      setConcluding(false);
    }
  };

  const handleEnviarTermo = async () => {
    setSendingTermo(true);
    try {
      const { data, error } = await supabase.functions.invoke('autentique-os-saida-create', {
        body: { ordem_servico_id: os.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar termo');

      setSignatureLink(data.signatureLink);

      // Atualizar status para pendente_assinatura
      await updateStatus.mutateAsync({
        id: os.id,
        status: 'pendente_assinatura' as any,
        observacao: 'Termo de Saída enviado para assinatura',
      });

      queryClient.invalidateQueries({ queryKey: ['ordem_servico', os.id] });
      toast.success('Termo enviado para assinatura!');

      // Fechar modal após envio com sucesso
      onOpenChange(false);
    } catch (err: any) {
      console.error('[OSConclusao] Erro ao enviar termo:', err);
      toast.error('Erro ao enviar termo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSendingTermo(false);
    }
  };

  const handleCopyLink = () => {
    if (signatureLink) {
      navigator.clipboard.writeText(signatureLink);
      toast.success('Link copiado!');
    }
  };

  const handleSendWhatsApp = () => {
    if (!signatureLink || !associado) return;
    const phone = (associado.whatsapp || associado.telefone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá ${associado.nome}! Segue o link para assinar o Termo de Saída do seu veículo: ${signatureLink}`);
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  const handleLiberarVeiculo = async () => {
    if (!window.confirm('Confirma a liberação do veículo? O sinistro e a OS serão encerrados.')) return;

    setLiberando(true);
    try {
      // 1. Finalizar OS
      await supabase.from('ordens_servico').update({
        status: 'finalizado',
        updated_at: new Date().toISOString(),
      } as any).eq('id', os.id);

      // 2. Encerrar sinistro vinculado
      if (os.sinistro_id) {
        await supabase.from('sinistros').update({
          status: 'encerrado',
          updated_at: new Date().toISOString(),
        }).eq('id', os.sinistro_id);

        await (supabase.from('sinistros_historico' as any) as any).insert({
          sinistro_id: os.sinistro_id,
          status_novo: 'encerrado',
          observacao: 'Veículo liberado após assinatura do Termo de Saída',
        });
      }

      // 3. Histórico OS
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: os.id,
        status_novo: 'finalizado',
        observacao: 'Veículo liberado - Termo de Saída assinado',
      } as any);

      queryClient.invalidateQueries({ queryKey: ['ordem_servico'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      toast.success('Veículo liberado! Sinistro e OS encerrados.');
      onOpenChange(false);
    } catch (err) {
      console.error('[OSConclusao] Erro ao liberar veículo:', err);
      toast.error('Erro ao liberar veículo');
    } finally {
      setLiberando(false);
    }
  };

  if (!os) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {assinado ? 'Veículo Liberado' : 'Concluir Ordem de Serviço'}
          </DialogTitle>
          <DialogDescription>OS {os.numero}</DialogDescription>
        </DialogHeader>

        {/* Badge de status */}
        {assinado && (
          <div className="flex justify-center">
            <Badge className="bg-green-600 text-white text-sm px-4 py-1.5 gap-1.5">
              <CheckCircle className="h-4 w-4" />
              Veículo Liberado - Termo Assinado
            </Badge>
          </div>
        )}

        {/* Dados do associado */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {associado?.nome}
            </div>
            <div className="flex flex-wrap gap-2">
              {associado?.telefone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${associado.telefone}`}>
                    <Phone className="h-3.5 w-3.5 mr-1" />
                    {associado.telefone}
                  </a>
                </Button>
              )}
              {(associado?.whatsapp || associado?.telefone) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const phone = (associado.whatsapp || associado.telefone || '').replace(/\D/g, '');
                  window.open(`https://wa.me/55${phone}`, '_blank');
                }}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" />
                  WhatsApp
                </Button>
              )}
              {associado?.email && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${associado.email}`}>
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    {associado.email}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo OS */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span>{veiculo?.placa} - {veiculo?.marca} {veiculo?.modelo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{oficina?.nome_fantasia || oficina?.razao_social}</span>
          </div>
        </div>

        {/* Custo da OS */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Orçamento</span>
              <span className="text-xl font-bold text-primary">
                {Number(os.valor_orcamento || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            {os.valor_aprovado && os.valor_aprovado !== os.valor_orcamento && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">Valor Aprovado</span>
                <span className="text-sm font-semibold">
                  {Number(os.valor_aprovado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Step 1: Concluir */}
        {step === 'confirm' && os.status !== 'concluido' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao concluir, o associado será notificado via WhatsApp que o veículo está pronto.
            </p>
            <Button
              className="w-full"
              onClick={handleConcluir}
              disabled={concluding}
            >
              {concluding ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Concluindo...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" />Concluir e Notificar Associado</>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Assinatura */}
        {(step === 'signature' || os.status === 'concluido' || os.status === 'pendente_assinatura') && (
          <div className="space-y-4">
            {!signatureLink && !assinado && (
              <Button
                className="w-full"
                onClick={handleEnviarTermo}
                disabled={sendingTermo}
              >
                {sendingTermo ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando termo...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" />Enviar Termo para Assinatura</>
                )}
              </Button>
            )}

            {signatureLink && !assinado && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-2">Link de assinatura:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded truncate">
                      {signatureLink}
                    </code>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyLink}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar Link
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleSendWhatsApp}>
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    Enviar WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={signatureLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Aguardando assinatura... (verificação automática a cada 10s)
                </p>
              </div>
            )}

            {assinado && os.termo_saida_url && (
              <Button variant="outline" className="w-full" asChild>
                <a href={os.termo_saida_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visualizar PDF Assinado
                </a>
              </Button>
            )}

            {assinado && (
              <Button
                className="w-full"
                variant="default"
                onClick={handleLiberarVeiculo}
                disabled={liberando}
              >
                {liberando ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Liberando...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" />Liberar Veículo</>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
