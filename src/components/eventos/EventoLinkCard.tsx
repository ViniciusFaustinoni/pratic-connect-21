import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEventoLink } from '@/hooks/useEventoLink';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  LinkIcon, RefreshCw, CheckCircle, Clock, AlertTriangle, 
  XCircle, Copy, ExternalLink, Loader2, Send 
} from 'lucide-react';
import { toast } from 'sonner';

interface EventoLinkCardProps {
  sinistroId: string;
  sinistroProtocolo?: string;
  associadoWhatsapp?: string | null;
  associadoNome?: string | null;
  sinistroTipo?: string;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  ativo: { label: 'Ativo', icon: CheckCircle, className: 'bg-green-100 text-green-800' },
  expirado: { label: 'Expirado', icon: AlertTriangle, className: 'bg-amber-100 text-amber-800' },
  completado: { label: 'Completado', icon: CheckCircle, className: 'bg-blue-100 text-blue-800' },
  invalidado: { label: 'Invalidado', icon: XCircle, className: 'bg-gray-100 text-gray-800' },
};

export function EventoLinkCard({ sinistroId, sinistroProtocolo, associadoWhatsapp, associadoNome, sinistroTipo }: EventoLinkCardProps) {
  const { linkAtivo, isLoading, contato, gerarNovoLink } = useEventoLink(sinistroId);
  const [copied, setCopied] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Verificar se link expirou (cliente-side)
  const isExpirado = linkAtivo?.status === 'ativo' && new Date(linkAtivo.expira_em) < new Date();
  const statusFinal = isExpirado ? 'expirado' : (linkAtivo?.status || 'sem_link');
  const config = statusConfig[statusFinal];

  const siteUrl = 'https://pratic-connect-21.lovable.app';
  const linkUrl = linkAtivo?.token ? `${siteUrl}/evento/${linkAtivo.token}` : '';

  const handleCopy = () => {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    if (!associadoWhatsapp || !linkUrl) return;
    const phone = associadoWhatsapp.replace(/\D/g, '');
    // Montar etapas e descrições por tipo de sinistro
    const etapasWhatsApp: Record<string, { etapas: string[]; descricoes: string[] }> = {
      vidros: {
        etapas: ['Fotos do Dano'],
        descricoes: ['Envie fotos do vidro danificado'],
      },
      fenomeno_natural: {
        etapas: ['B.O. + Fotos do Dano', 'Comprovante + Fotos In Loco'],
        descricoes: ['Envie o B.O. e fotos dos danos', 'Envie comprovantes e fotos do local'],
      },
      roubo: {
        etapas: ['Boletim de Ocorrência', 'Documentação'],
        descricoes: ['Envie o B.O. registrado', 'Envie os documentos solicitados'],
      },
      furto: {
        etapas: ['Boletim de Ocorrência', 'Chaves + Documentos'],
        descricoes: ['Envie o B.O. registrado', 'Envie chaves e documentos'],
      },
      default: {
        etapas: ['Auto Vistoria', 'Boletim de Ocorrência'],
        descricoes: ['Envie fotos do veículo conforme orientações', 'Envie o B.O. registrado'],
      },
    };

    const tipoKey = sinistroTipo && etapasWhatsApp[sinistroTipo] ? sinistroTipo : 'default';
    const { etapas: etapasMsg, descricoes } = etapasWhatsApp[tipoKey];
    // Adicionar etapas fixas: Agendamento e Cota de Coparticipação
    const finalEtapas = [...etapasMsg, 'Agendamento', 'Cota de Coparticipação'];
    const finalDescricoes = [...descricoes, 'Agende a vistoria presencial', 'Pagamento da cota conforme seu plano'];
    const etapasTexto = finalEtapas.map((e, i) => `${i + 1}. *${e}* - ${finalDescricoes[i]}`).join('\n');

    const mensagem = `Olá ${associadoNome || ''}! Somos da *ABP PraticCar* e estamos aqui para te ajudar nesse momento.\n\nSeu evento *${sinistroProtocolo || ''}* foi registrado e precisamos que você complete algumas etapas pelo link abaixo:\n\n${etapasTexto}\n\nAcesse aqui: ${linkUrl}\n\nO link é válido por *72 horas*.\n\nApós a conclusão, nossa equipe analisará seu caso. Lembrando que, conforme seu plano, será aplicada a *cota de coparticipação* sobre o valor de referência do veículo.\n\nQualquer dúvida, estamos à disposição!\n\nABP PraticCar`;

    try {
      setEnviando(true);
      const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { telefone: phone, mensagem }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erro ao enviar');

      toast.success('Link enviado via WhatsApp!');
    } catch (err: any) {
      console.error('Erro ao enviar WhatsApp:', err);
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const isRouboFurto = sinistroTipo === 'roubo' || sinistroTipo === 'furto';
  const isVidros = sinistroTipo === 'vidros';
  const isFenomenoNatural = sinistroTipo === 'fenomeno_natural';
  
  const etapaLabels = isVidros
    ? ['Não iniciou', 'Fotos do Dano', 'Relato Simples']
    : isFenomenoNatural
    ? ['Não iniciou', 'B.O. + Fotos do Dano', 'Comprovante + Fotos In Loco', 'Relato Completo']
    : isRouboFurto 
    ? ['Não iniciou', 'B.O.', 'Relato', sinistroTipo === 'furto' ? 'Chaves + Docs' : 'Documentação']
    : ['Não iniciou', 'Auto Vistoria', 'B.O.', 'Relato Completo'];
  
  const totalEtapas = isVidros ? 2 : 3;

  return (
    <Card className={statusFinal === 'ativo' ? 'border-green-500/50' : statusFinal === 'expirado' ? 'border-amber-500/50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LinkIcon className="h-5 w-5" />
          Link do Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!linkAtivo ? (
          <div className="text-center py-4">
            <LinkIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Nenhum link gerado</p>
            <Button
              size="sm"
              onClick={() => gerarNovoLink.mutate()}
              disabled={gerarNovoLink.isPending}
            >
              {gerarNovoLink.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar Link
            </Button>
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="flex items-center gap-2">
              {config && (
                <Badge className={config.className}>
                  <config.icon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Etapa {linkAtivo.etapa_atual}/{totalEtapas}
              </Badge>
            </div>

            {/* Progresso */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span>{etapaLabels[linkAtivo.etapa_atual] || 'Concluído'}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(linkAtivo.etapa_atual / totalEtapas) * 100}%` }}
                />
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Criado em</span>
                <p className="font-medium">
                  {format(new Date(linkAtivo.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Expira em</span>
                <p className={`font-medium ${isExpirado ? 'text-red-500' : ''}`}>
                  {format(new Date(linkAtivo.expira_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Contato agendado */}
            {contato && (
              <>
                <Separator />
                <div className="text-xs space-y-1">
                  <p className="text-muted-foreground">Contato WhatsApp</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {contato.status === 'enviado' ? '✓ Enviado' : contato.status === 'erro' ? '✗ Erro' : '⏰ Agendado'}
                    </Badge>
                    {contato.agendado_para && contato.status === 'agendado' && (
                      <span>
                        {format(new Date(contato.agendado_para), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {contato.enviado_em && (
                      <span>
                        {format(new Date(contato.enviado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Ações */}
            <div className="space-y-2">
              {statusFinal === 'ativo' && (
                <>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleCopy}>
                    {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </Button>
                  {associadoWhatsapp && (
                    <Button variant="outline" size="sm" className="w-full" onClick={handleWhatsApp} disabled={enviando}>
                      {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {enviando ? 'Enviando...' : 'Enviar via WhatsApp'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => window.open(linkUrl, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir página
                  </Button>
                </>
              )}

              {(statusFinal === 'expirado' || statusFinal === 'invalidado') && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => gerarNovoLink.mutate()}
                  disabled={gerarNovoLink.isPending}
                >
                  {gerarNovoLink.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Gerar Novo Link
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
