import { ArrowLeft, Copy, Download, Send, Phone, MessageSquare, 
         AlertTriangle, ExternalLink, MoreVertical, Mail, Ban, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
         DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useAsaas } from '@/hooks/useAsaas';

const statusConfig: Record<string, { label: string; class: string }> = {
  'PENDING': { label: 'Pendente', class: 'bg-yellow-100 text-yellow-800' },
  'RECEIVED': { label: 'Pago', class: 'bg-green-100 text-green-800' },
  'CONFIRMED': { label: 'Confirmado', class: 'bg-green-100 text-green-800' },
  'OVERDUE': { label: 'Vencido', class: 'bg-red-100 text-red-800' },
  'CANCELED': { label: 'Cancelado', class: 'bg-gray-100 text-gray-800' },
  'REFUNDED': { label: 'Estornado', class: 'bg-orange-100 text-orange-800' },
};

const tipoConfig: Record<string, { label: string; class: string }> = {
  'mensalidade': { label: 'Mensalidade', class: 'bg-blue-100 text-blue-800' },
  'adesao': { label: 'Taxa de Filiação', class: 'bg-purple-100 text-purple-800' },
  'taxa_instalacao': { label: 'Taxa Instalação', class: 'bg-indigo-100 text-indigo-800' },
  'taxa_vistoria': { label: 'Taxa Vistoria', class: 'bg-cyan-100 text-cyan-800' },
  'participacao_sinistro': { label: 'Participação Sinistro', class: 'bg-orange-100 text-orange-800' },
  'avulso': { label: 'Avulso', class: 'bg-gray-100 text-gray-800' },
  'MENSALIDADE': { label: 'Mensalidade', class: 'bg-blue-100 text-blue-800' },
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatCPF = (cpf: string | null | undefined) => {
  if (!cpf) return '-';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatTelefone = (tel: string | null | undefined) => {
  if (!tel) return '-';
  const clean = tel.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return tel;
};

const formatLinhaDigitavel = (linha: string | null | undefined) => {
  if (!linha) return '';
  // Formatar em blocos para melhor legibilidade
  const clean = linha.replace(/\D/g, '');
  return clean.replace(/(.{5})/g, '$1 ').trim();
};

export default function CobrancaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cancelarCobranca, gerarSegundaVia } = useAsaas();

  const { data: cobranca, isLoading, error } = useQuery({
    queryKey: ['cobranca', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select(`
          *,
          associado:associados(*),
          veiculo:veiculos(id, placa, marca, modelo),
          criado_por_usuario:profiles!asaas_cobrancas_criado_por_fkey(nome)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const copiarParaClipboard = async (texto: string, descricao: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${descricao} copiado!`);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const calcularDiasAtraso = (dataVencimento: string | null) => {
    if (!dataVencimento) return 0;
    const venc = parseISO(dataVencimento);
    if (isPast(venc)) {
      return differenceInDays(new Date(), venc);
    }
    return 0;
  };

  const isVencido = (status: string, dataVencimento: string | null) => {
    if (status === 'OVERDUE') return true;
    if (!dataVencimento) return false;
    const venc = parseISO(dataVencimento);
    return isPast(venc) && !['RECEIVED', 'CONFIRMED', 'CANCELED', 'REFUNDED'].includes(status);
  };

  const handleCancelarCobranca = async () => {
    if (!cobranca?.asaas_id) return;
    
    if (cobranca.asaas_id.startsWith('local_')) {
      // Cobrança local - cancelar diretamente no banco
      const { error } = await supabase
        .from('asaas_cobrancas')
        .update({ status: 'CANCELED' })
        .eq('id', cobranca.id);
      
      if (error) {
        toast.error('Erro ao cancelar cobrança');
        return;
      }
      
      toast.success('Cobrança cancelada!');
      queryClient.invalidateQueries({ queryKey: ['cobranca', id] });
      return;
    }
    
    try {
      await cancelarCobranca.mutateAsync(cobranca.asaas_id);
      queryClient.invalidateQueries({ queryKey: ['cobranca', id] });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleGerarSegundaVia = async () => {
    if (!cobranca?.asaas_id || cobranca.asaas_id.startsWith('local_')) {
      toast.error('Segunda via disponível apenas para cobranças ASAAS');
      return;
    }
    
    try {
      await gerarSegundaVia.mutateAsync(cobranca.asaas_id);
      queryClient.invalidateQueries({ queryKey: ['cobranca', id] });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleEnviarWhatsApp = () => {
    if (!cobranca?.associado?.whatsapp && !cobranca?.associado?.telefone) {
      toast.error('Associado não possui telefone cadastrado');
      return;
    }
    
    const telefone = (cobranca.associado.whatsapp || cobranca.associado.telefone || '').replace(/\D/g, '');
    const valor = formatCurrency(cobranca.valor_liquido || cobranca.valor);
    const vencimento = cobranca.data_vencimento 
      ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy')
      : '';
    
    let mensagem = `Olá ${cobranca.associado.nome}! Segue sua cobrança:\n\n`;
    mensagem += `💰 Valor: ${valor}\n`;
    mensagem += `📅 Vencimento: ${vencimento}\n\n`;
    
    if (cobranca.pix_copia_cola) {
      mensagem += `📱 PIX Copia e Cola:\n${cobranca.pix_copia_cola}\n\n`;
    }
    
    if (cobranca.boleto_url) {
      mensagem += `📄 Boleto: ${cobranca.boleto_url}`;
    }
    
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !cobranca) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/financeiro/cobrancas')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Cobrança não encontrada ou erro ao carregar dados.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const status = statusConfig[cobranca.status] || { label: cobranca.status, class: 'bg-gray-100 text-gray-800' };
  const tipo = tipoConfig[cobranca.tipo] || { label: cobranca.tipo, class: 'bg-gray-100 text-gray-800' };
  const diasAtraso = calcularDiasAtraso(cobranca.data_vencimento);
  const mostrarAlertaVencido = isVencido(cobranca.status, cobranca.data_vencimento);
  const valorFinal = cobranca.valor_liquido || cobranca.valor || 0;
  const isPago = ['RECEIVED', 'CONFIRMED'].includes(cobranca.status);
  const isCancelado = cobranca.status === 'CANCELED';
  const podeCancelar = !isPago && !isCancelado;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/financeiro/cobrancas')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Cobrança #{cobranca.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {cobranca.asaas_id && `ASAAS: ${cobranca.asaas_id}`}
            </p>
          </div>
          <Badge className={status.class}>{status.label}</Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="mr-2 h-4 w-4" />
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleEnviarWhatsApp}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Enviar por WhatsApp
            </DropdownMenuItem>
            {cobranca.boleto_url && (
              <DropdownMenuItem onClick={() => window.open(cobranca.boleto_url, '_blank')}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF do Boleto
              </DropdownMenuItem>
            )}
            {!isPago && !isCancelado && !cobranca.asaas_id?.startsWith('local_') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleGerarSegundaVia}
                  disabled={gerarSegundaVia.isPending}
                >
                  {gerarSegundaVia.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Gerar Segunda Via
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {podeCancelar && (
              <DropdownMenuItem 
                onClick={handleCancelarCobranca}
                className="text-destructive"
                disabled={cancelarCobranca.isPending}
              >
                {cancelarCobranca.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="mr-2 h-4 w-4" />
                )}
                Cancelar Cobrança
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Alerta de Vencimento */}
      {mostrarAlertaVencido && diasAtraso > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cobrança Vencida</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Esta cobrança está vencida há {diasAtraso} {diasAtraso === 1 ? 'dia' : 'dias'}.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleEnviarWhatsApp}>
                <Send className="mr-2 h-4 w-4" />
                Enviar Lembrete
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados da Cobrança */}
          <Card>
            <CardHeader>
              <CardTitle>Dados da Cobrança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge className={tipo.class}>{tipo.label}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Competência</p>
                  <p className="font-medium">{cobranca.competencia || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Referência</p>
                  <p className="font-medium">{cobranca.referencia || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Emissão</p>
                  <p className="font-medium">
                    {cobranca.data_emissao 
                      ? format(parseISO(cobranca.data_emissao), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Vencimento</p>
                  <p className={`font-medium ${mostrarAlertaVencido ? 'text-destructive' : ''}`}>
                    {cobranca.data_vencimento 
                      ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                {isPago && cobranca.data_pagamento && (
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Pagamento</p>
                    <p className="font-medium text-green-600">
                      {format(parseISO(cobranca.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle>Valores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor original</span>
                <span>{formatCurrency(cobranca.valor)}</span>
              </div>
              {Number(cobranca.desconto) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto</span>
                  <span>- {formatCurrency(cobranca.desconto)}</span>
                </div>
              )}
              {Number(cobranca.juros) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Juros</span>
                  <span>+ {formatCurrency(cobranca.juros)}</span>
                </div>
              )}
              {Number(cobranca.multa) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Multa</span>
                  <span>+ {formatCurrency(cobranca.multa)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Valor Final</span>
                <span>{formatCurrency(valorFinal)}</span>
              </div>
              {isPago && (
                <>
                  <Separator />
                  <div className="flex justify-between text-green-600">
                    <span>Valor Pago</span>
                    <span className="font-medium">{formatCurrency(cobranca.pagamento_valor)}</span>
                  </div>
                  {cobranca.pagamento_forma && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Forma de Pagamento</span>
                      <span>{cobranca.pagamento_forma}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Boleto */}
          {(cobranca.boleto_url || cobranca.linha_digitavel) && (
            <Card>
              <CardHeader>
                <CardTitle>Boleto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cobranca.linha_digitavel && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Linha Digitável</p>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                      {formatLinhaDigitavel(cobranca.linha_digitavel)}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => copiarParaClipboard(cobranca.linha_digitavel!, 'Linha digitável')}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Linha Digitável
                    </Button>
                  </div>
                )}
                {cobranca.boleto_nosso_numero && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nosso Número</p>
                    <p className="font-medium">{cobranca.boleto_nosso_numero}</p>
                  </div>
                )}
                {cobranca.boleto_url && (
                  <Button variant="outline" onClick={() => window.open(cobranca.boleto_url, '_blank')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir PDF do Boleto
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* PIX */}
          {(cobranca.pix_qrcode || cobranca.pix_copia_cola) && (
            <Card>
              <CardHeader>
                <CardTitle>PIX</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-6">
                  {cobranca.pix_qrcode && (
                    <div className="flex-shrink-0">
                      <QRCodeSVG value={cobranca.pix_qrcode} size={150} />
                    </div>
                  )}
                  <div className="flex-1 space-y-4">
                    {cobranca.pix_copia_cola && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Código Copia e Cola</p>
                        <div className="bg-muted p-3 rounded-md text-sm break-all max-h-24 overflow-y-auto">
                          {cobranca.pix_copia_cola}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => copiarParaClipboard(cobranca.pix_copia_cola!, 'Código PIX')}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar Código PIX
                        </Button>
                      </div>
                    )}
                    {cobranca.pix_expiracao && (
                      <div>
                        <p className="text-sm text-muted-foreground">Expira em</p>
                        <p className="font-medium">
                          {format(parseISO(cobranca.pix_expiracao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          {/* Associado */}
          <Card>
            <CardHeader>
              <CardTitle>Associado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cobranca.associado ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{cobranca.associado.nome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPF</p>
                    <p className="font-medium">{formatCPF(cobranca.associado.cpf)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <a 
                      href={`tel:${cobranca.associado.telefone}`} 
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Phone className="h-3 w-3" />
                      {formatTelefone(cobranca.associado.telefone)}
                    </a>
                  </div>
                  {cobranca.associado.whatsapp && (
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <a 
                        href={`https://wa.me/55${cobranca.associado.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-green-600 hover:underline flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {formatTelefone(cobranca.associado.whatsapp)}
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="outline">{cobranca.associado.status}</Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate(`/cadastro/associados/${cobranca.associado.id}`)}
                  >
                    Ver Perfil
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Associado não encontrado</p>
              )}
            </CardContent>
          </Card>

          {/* Veículo */}
          {cobranca.veiculo && (
            <Card>
              <CardHeader>
                <CardTitle>Veículo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Placa</p>
                  <p className="font-medium text-lg">{cobranca.veiculo.placa}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Marca/Modelo</p>
                  <p className="font-medium">
                    {cobranca.veiculo.marca} {cobranca.veiculo.modelo}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informações Adicionais */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cobranca.criado_por_usuario && (
                <div>
                  <p className="text-muted-foreground">Criado por</p>
                  <p className="font-medium">{cobranca.criado_por_usuario.nome}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Criado em</p>
                <p className="font-medium">
                  {cobranca.created_at 
                    ? format(parseISO(cobranca.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Atualizado em</p>
                <p className="font-medium">
                  {cobranca.updated_at 
                    ? format(parseISO(cobranca.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '-'}
                </p>
              </div>
              {cobranca.asaas_id && (
                <div>
                  <p className="text-muted-foreground">ID ASAAS</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{cobranca.asaas_id}</code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => copiarParaClipboard(cobranca.asaas_id, 'ID ASAAS')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              {cobranca.contrato_id && (
                <div>
                  <p className="text-muted-foreground">ID Contrato</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{cobranca.contrato_id.slice(0, 8)}</code>
                </div>
              )}
              {isCancelado && cobranca.motivo_cancelamento && (
                <div>
                  <p className="text-muted-foreground">Motivo Cancelamento</p>
                  <p className="font-medium text-destructive">{cobranca.motivo_cancelamento}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer de Ações */}
      {!isPago && !isCancelado && (
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Button variant="outline" onClick={handleEnviarWhatsApp}>
              <Send className="mr-2 h-4 w-4" />
              Enviar por WhatsApp
            </Button>
            {!cobranca.asaas_id?.startsWith('local_') && (
              <Button 
                variant="outline" 
                onClick={handleGerarSegundaVia}
                disabled={gerarSegundaVia.isPending}
              >
                {gerarSegundaVia.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Segunda Via
              </Button>
            )}
            <Button 
              variant="destructive" 
              onClick={handleCancelarCobranca}
              disabled={cancelarCobranca.isPending}
            >
              {cancelarCobranca.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
