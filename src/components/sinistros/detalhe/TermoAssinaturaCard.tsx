import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileSignature, CheckCircle, Clock, Copy, Send, ExternalLink, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function TermoAssinaturaCard({ sinistro }: { sinistro: any }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const isAssinado = sinistro.termo_anuencia_assinado === true;

  useEffect(() => {
    if (isAssinado) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
    }, 15000);
    return () => clearInterval(interval);
  }, [isAssinado, sinistro.id, queryClient]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sinistro.autentique_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const phone = sinistro.associado?.whatsapp || sinistro.associado?.telefone;
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá ${sinistro.associado?.nome || ''}! O reparo do seu evento (protocolo ${sinistro.protocolo}) foi aprovado. Por favor, assine o Termo de Entrada de Evento no link abaixo:\n\n${sinistro.autentique_url}`
    );
    window.open(`https://wa.me/55${cleaned}?text=${msg}`, '_blank');
  };

  return (
    <Card className={isAssinado ? 'border-green-500/50' : 'border-amber-500/50'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-5 w-5" /> Termo de Entrada de Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {isAssinado ? (
            <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Assinado</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />Aguardando Assinatura</Badge>
          )}
        </div>
        {isAssinado && sinistro.termo_anuencia_assinado_em && (
          <p className="text-xs text-muted-foreground">
            Assinado em {format(new Date(sinistro.termo_anuencia_assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
        {isAssinado && sinistro.termo_anuencia_url && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={sinistro.termo_anuencia_url} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-2" /> Baixar PDF Assinado
            </a>
          </Button>
        )}
        {!isAssinado && (
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full" onClick={handleCopy}>
              {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleWhatsApp}>
              <Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => window.open(sinistro.autentique_url, '_blank')}>
              <ExternalLink className="h-3 w-3 mr-1" /> Abrir página de assinatura
            </Button>
          </div>
        )}
        {!isAssinado && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Atualiza automaticamente
          </p>
        )}
      </CardContent>
    </Card>
  );
}
