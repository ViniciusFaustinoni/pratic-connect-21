import { useParams, useNavigate } from 'react-router-dom';
import { useContrato } from '@/hooks/useContratos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, Mail, Phone, Copy, ExternalLink, 
  Clock, FileText, CalendarCheck, Car, Link as LinkIcon,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const proximosPassos = [
  {
    icon: Clock,
    texto: 'Aguardar assinatura do cliente (prazo: 7 dias)',
  },
  {
    icon: FileText,
    texto: 'Após assinatura, documentos vão para análise',
  },
  {
    icon: CalendarCheck,
    texto: 'Aprovação → Agendamento de instalação do rastreador',
  },
  {
    icon: Car,
    texto: 'Instalação → Ativação da proteção',
  },
];

const ContratoEnviado = () => {
  const { contratoId } = useParams<{ contratoId: string }>();
  const navigate = useNavigate();
  const { data: contrato, isLoading } = useContrato(contratoId);

  const copiarLink = () => {
    if (contrato?.autentique_url) {
      navigator.clipboard.writeText(contrato.autentique_url);
      toast.success('Link copiado para a área de transferência!');
    }
  };

  const abrirLink = () => {
    if (contrato?.autentique_url) {
      window.open(contrato.autentique_url, '_blank');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (!contrato) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold text-destructive">Contrato não encontrado</h1>
          <p className="text-muted-foreground">
            O contrato solicitado não existe ou você não tem permissão para visualizá-lo.
          </p>
          <Button onClick={() => navigate('/vendas/leads')}>
            Voltar para Leads
          </Button>
        </div>
      </div>
    );
  }

  const telefone = contrato.leads?.telefone || 'Não informado';
  const email = contrato.leads?.email || 'Não informado';

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      {/* Header com ícone de sucesso */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle className="h-16 w-16 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-green-600">CONTRATO ENVIADO!</h1>
      </div>

      {/* Card de Confirmação */}
      <Card className="bg-green-50 border-green-200 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <Mail className="h-10 w-10 text-green-600" />
            <p className="text-lg font-medium text-green-800">
              O contrato <span className="font-bold">{contrato.numero}</span> foi enviado para assinatura!
            </p>
            <div className="flex flex-col gap-2 text-green-700">
              <div className="flex items-center gap-2 justify-center">
                <Phone className="h-4 w-4" />
                <span>WhatsApp em {telefone}</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Mail className="h-4 w-4" />
                <span>E-mail em {email}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Link de Assinatura */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-5 w-5" />
            Link de Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contrato.autentique_url ? (
            <div className="flex gap-2">
              <Input 
                value={contrato.autentique_url} 
                readOnly 
                className="flex-1 bg-muted"
              />
              <Button variant="outline" size="icon" onClick={copiarLink} title="Copiar link">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={abrirLink} title="Abrir link">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              O link de assinatura ainda não está disponível. Aguarde alguns instantes.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card Próximos Passos */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Próximos Passos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {proximosPassos.map((passo, index) => {
              const Icon = passo.icon;
              return (
                <li key={index} className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{passo.texto}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Footer com botões */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          variant="outline" 
          onClick={() => navigate(`/vendas/contratos/${contratoId}`)}
        >
          Ver Contrato
        </Button>
        <Button 
          variant="outline" 
          onClick={() => navigate('/vendas/cotador')}
        >
          Nova Cotação
        </Button>
        <Button 
          onClick={() => navigate('/vendas/leads')}
        >
          Voltar para Leads
        </Button>
      </div>
    </div>
  );
};

export default ContratoEnviado;
