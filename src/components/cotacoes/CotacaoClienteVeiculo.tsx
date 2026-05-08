import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  Car,
  Phone,
  Mail,
  ExternalLink,
  Link2,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  IdCard,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CotacaoClienteVeiculoProps {
  cotacao: {
    id: string;
    lead_id?: string | null;
    leads?: {
      id?: string;
      nome?: string | null;
      telefone?: string | null;
      email?: string | null;
    } | null;
    /** Dados do solicitante salvos diretamente na cotação (avulsa / troca de titularidade) */
    nome_solicitante?: string | null;
    cliente_cpf?: string | null;
    email_solicitante?: string | null;
    telefone1_solicitante?: string | null;
    veiculo_marca?: string | null;
    veiculo_modelo?: string | null;
    veiculo_ano?: number | null;
    veiculo_placa?: string | null;
    valor_fipe?: number | null;
    dados_extras?: { tipo_entrada?: string | null } | null;
  };
  onVincularLead: () => void;
  onTrocarLead: () => void;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPhone = (phone: string | null | undefined) => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatCpf = (cpf: string | null | undefined) => {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export function CotacaoClienteVeiculo({
  cotacao,
  onVincularLead,
  onTrocarLead,
}: CotacaoClienteVeiculoProps) {
  const temLead = !!cotacao.lead_id;

  // Dados unificados: lead tem prioridade; senão, usa solicitante da própria cotação
  const nome = temLead ? cotacao.leads?.nome : cotacao.nome_solicitante;
  const telefone = temLead ? cotacao.leads?.telefone : cotacao.telefone1_solicitante;
  const email = temLead ? cotacao.leads?.email : cotacao.email_solicitante;
  const cpfFormatado = !temLead ? formatCpf(cotacao.cliente_cpf) : null;

  const temSolicitante = !temLead && !!cotacao.nome_solicitante;
  const isTroca = cotacao.dados_extras?.tipo_entrada === 'troca_titularidade';
  const semNada = !temLead && !temSolicitante;

  const telefoneDigits = (telefone || '').replace(/\D/g, '');

  const handleLigar = () => {
    if (telefoneDigits) window.location.href = `tel:+55${telefoneDigits}`;
  };

  const handleWhatsApp = () => {
    if (telefoneDigits) window.open(`https://wa.me/55${telefoneDigits}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Card Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Cliente
              </CardTitle>
              {temLead && (
                <Button variant="ghost" size="sm" onClick={onTrocarLead}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Trocar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {semNada ? (
              <div className="text-center py-4 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Cotação avulsa</p>
                <p className="text-xs">Vincule a um lead para enviar</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-lg">{nome || 'Sem nome'}</p>
                  {!temLead && (
                    <Badge variant="secondary" className="text-[10px]">
                      {isTroca ? 'Novo titular' : 'Solicitante (avulsa)'}
                    </Badge>
                  )}
                </div>

                {cpfFormatado && (
                  <div className="flex items-center gap-2 text-sm">
                    <IdCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{cpfFormatado}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{formatPhone(telefone)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{email || '—'}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLigar}
                    disabled={!telefoneDigits}
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    Ligar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleWhatsApp}
                    disabled={!telefoneDigits}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Button>
                </div>

                {temLead && cotacao.leads?.id && (
                  <Button variant="link" size="sm" className="p-0" asChild>
                    <Link to={`/vendas/leads/${cotacao.leads.id}`}>
                      Ver Lead
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}

                {!temLead && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-xs"
                    onClick={onVincularLead}
                  >
                    <Link2 className="mr-1 h-3 w-3" />
                    Vincular a um lead
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Veículo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" />
              Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="font-semibold text-lg">
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Ano</p>
                  <p className="font-medium">{cotacao.veiculo_ano || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Placa</p>
                  <p className="font-mono uppercase font-medium">
                    {cotacao.veiculo_placa || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">FIPE</p>
                  <p className="font-medium text-primary">
                    {formatCurrency(cotacao.valor_fipe)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta só quando NÃO há lead nem solicitante */}
      {semNada && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-300">
              Cotação avulsa — Vincule a um lead para habilitar envio
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onVincularLead}
              className="ml-4"
            >
              <Link2 className="h-3 w-3 mr-1" />
              Vincular Lead
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
