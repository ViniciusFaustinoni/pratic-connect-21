import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLead } from '@/hooks/useLeads';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { useState } from 'react';

const etapaColors: Record<EtapaLead, string> = {
  novo: 'bg-[hsl(var(--etapa-novo))] text-white',
  contato_inicial: 'bg-[hsl(var(--etapa-contato))] text-white',
  apresentacao: 'bg-[hsl(var(--etapa-apresentacao))] text-white',
  cotacao_enviada: 'bg-[hsl(var(--etapa-cotacao))] text-white',
  negociacao: 'bg-[hsl(var(--etapa-negociacao))] text-white',
  ganho: 'bg-[hsl(var(--etapa-ganho))] text-white',
  perdido: 'bg-[hsl(var(--etapa-perdido))] text-white',
};

export default function LeadDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return <div className="text-center py-8">Lead não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vendas/leads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.nome}</h1>
          <p className="text-muted-foreground">Lead criado em {formatDate(lead.created_at)}</p>
        </div>
        <Badge className={etapaColors[lead.etapa]}>{ETAPA_LABELS[lead.etapa]}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dados de Contato</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{lead.telefone}</div>
            {lead.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{lead.email}</div>}
            <div><span className="text-muted-foreground">CPF:</span> {lead.cpf || '-'}</div>
            <div><span className="text-muted-foreground">Origem:</span> <Badge variant="outline">{ORIGEM_LABELS[lead.origem]}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dados do Veículo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lead.veiculo_marca ? (
              <>
                <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" />{lead.veiculo_marca} {lead.veiculo_modelo}</div>
                <div><span className="text-muted-foreground">Ano:</span> {lead.veiculo_ano || '-'}</div>
                <div><span className="text-muted-foreground">Placa:</span> {lead.veiculo_placa || '-'}</div>
                <div><span className="text-muted-foreground">Valor FIPE:</span> {formatCurrency(lead.veiculo_fipe)}</div>
              </>
            ) : <p className="text-muted-foreground">Nenhum veículo informado</p>}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setShowCotacaoForm(true)}>Criar Cotação</Button>
      </div>

      <CotacaoFormDialog open={showCotacaoForm} onOpenChange={setShowCotacaoForm} leadId={lead.id} />
    </div>
  );
}
