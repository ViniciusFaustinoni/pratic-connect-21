import { useState } from 'react';
import { 
  FileText, Clock, CheckCircle, Send, Phone, Mail, 
  TrendingUp, Calendar, User, Car
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useVendedorPropostas, type VendedorMetricas } from '@/hooks/usePropostasMetricas';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VendedorTabProps {
  vendedor: VendedorMetricas;
  periodo: 'semana' | 'mes';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

const etapaConfig: Record<string, { label: string; color: string }> = {
  cotacao_enviada: { label: 'Cotação Enviada', color: 'bg-yellow-100 text-yellow-800' },
  negociacao: { label: 'Em Negociação', color: 'bg-blue-100 text-blue-800' },
  contrato_enviado: { label: 'Contrato Enviado', color: 'bg-orange-100 text-orange-800' },
  contrato_assinado: { label: 'Contrato Assinado', color: 'bg-green-100 text-green-800' },
};

export function VendedorTab({ vendedor, periodo }: VendedorTabProps) {
  const [activeTab, setActiveTab] = useState('cotacao');
  const { data, isLoading } = useVendedorPropostas(vendedor.id, periodo);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum dado encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Vendedor */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border">
        <UserAvatar 
          src={vendedor.avatar_url} 
          name={vendedor.nome} 
          size="lg"
        />
        <div className="flex-1">
          <h2 className="text-xl font-bold">{vendedor.nome}</h2>
          <p className="text-sm text-muted-foreground">
            Ranking #{vendedor.ranking} • Taxa de conversão: {vendedor.taxaConversao.toFixed(0)}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(data.totalValorPeriodo)}
          </p>
          <p className="text-xs text-muted-foreground">
            Valor fechado {periodo === 'semana' ? 'na semana' : 'no mês'}
          </p>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{vendedor.leadsAtivos}</p>
                <p className="text-xs text-muted-foreground">Leads Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.emCotacao.length}</p>
                <p className="text-xs text-muted-foreground">Em Cotação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Send className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.propostasEnviadas.length}</p>
                <p className="text-xs text-muted-foreground">Aguardando Assinatura</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.fechadasNoPeriodo.length}</p>
                <p className="text-xs text-muted-foreground">
                  Fechadas {periodo === 'semana' ? 'na Semana' : 'no Mês'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Propostas */}
      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="cotacao" className="gap-2">
                <Clock className="h-4 w-4" />
                Em Cotação ({data.emCotacao.length})
              </TabsTrigger>
              <TabsTrigger value="enviadas" className="gap-2">
                <Send className="h-4 w-4" />
                Enviadas ({data.propostasEnviadas.length})
              </TabsTrigger>
              <TabsTrigger value="fechadas" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Fechadas ({data.propostasFechadas.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {activeTab === 'cotacao' && (
            <LeadsTable leads={data.emCotacao} />
          )}
          {activeTab === 'enviadas' && (
            <ContratosTable contratos={data.propostasEnviadas} />
          )}
          {activeTab === 'fechadas' && (
            <ContratosTable contratos={data.propostasFechadas} showValor />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeadsTable({ leads }: { leads: any[] }) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum lead em cotação
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Veículo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Contato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => {
          const etapa = etapaConfig[lead.etapa] || { label: lead.etapa, color: 'bg-gray-100 text-gray-800' };
          const veiculo = lead.veiculo_marca 
            ? `${lead.veiculo_marca} ${lead.veiculo_modelo || ''} ${lead.veiculo_ano || ''}`
            : '-';
          
          return (
            <TableRow key={lead.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{lead.nome || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm">{veiculo}</TableCell>
              <TableCell>
                <Badge className={etapa.color}>{etapa.label}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {lead.telefone && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => window.open(`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`, '_blank')}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  )}
                  {lead.email && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ContratosTable({ contratos, showValor }: { contratos: any[]; showValor?: boolean }) {
  if (contratos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma proposta encontrada
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800' },
    enviado: { label: 'Enviado', color: 'bg-yellow-100 text-yellow-800' },
    assinado: { label: 'Assinado', color: 'bg-green-100 text-green-800' },
    ativo: { label: 'Ativo', color: 'bg-blue-100 text-blue-800' },
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº Proposta</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Plano</TableHead>
          <TableHead>Status</TableHead>
          {showValor && <TableHead>Valor</TableHead>}
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contratos.map((contrato) => {
          const status = statusConfig[contrato.status] || { label: contrato.status, color: 'bg-gray-100 text-gray-800' };
          
          return (
            <TableRow key={contrato.id}>
              <TableCell className="font-mono text-sm">{contrato.numero}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{contrato.leads?.nome || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(contrato.leads?.telefone)}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm">{contrato.planos?.nome || '-'}</TableCell>
              <TableCell>
                <Badge className={status.color}>{status.label}</Badge>
              </TableCell>
              {showValor && (
                <TableCell className="font-medium text-green-600">
                  {formatCurrency(contrato.valor_mensal || 0)}
                </TableCell>
              )}
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(contrato.created_at), 'dd/MM/yy', { locale: ptBR })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
