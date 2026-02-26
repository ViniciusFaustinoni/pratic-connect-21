import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User,
  Car,
  FileText,
  Wrench,
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Hash,
  Smartphone,
  Wifi,
  AlertTriangle,
  Puzzle,
  Building2,
  CheckCircle,
  FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DocumentosAnexadosPanel } from '@/components/cadastro/DocumentosAnexadosPanel';

import type { PropostaPendente, DocumentoAnexado } from '@/hooks/usePropostasPendentes';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';

interface PropostaDetalhesTabsProps {
  proposta: PropostaPendente;
  onViewDocumento: (documento: DocumentoAnexadoCompleto) => void;
  // Para edição de RENAVAM/CHASSI
  veiculoRenavam: string;
  setVeiculoRenavam: (value: string) => void;
  veiculoChassi: string;
  setVeiculoChassi: (value: string) => void;
}

// Componente auxiliar para exibir informações
function InfoRow({
  icon: Icon,
  label,
  value,
  highlight,
  iconColor = 'text-muted-foreground',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
  iconColor?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="p-1.5 rounded-md bg-muted/50 flex-shrink-0">
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn(
          "text-foreground break-words", 
          highlight && "font-semibold"
        )}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}

// Formatar CPF com máscara
function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

// Formatar moeda
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function PropostaDetalhesTabs({
  proposta,
  onViewDocumento,
  veiculoRenavam,
  setVeiculoRenavam,
  veiculoChassi,
  setVeiculoChassi,
}: PropostaDetalhesTabsProps) {
  const associado = proposta.associado;
  
  // Contar documentos
  const totalDocumentos = (proposta.documentos?.length || 0);
  const documentosNovos = proposta.documentos_solicitados_enviados?.length || 0;
  
  // Verificar se tem instalação
  const temInstalacao = !!proposta.instalacao_info;
  const temAgendamento = !!proposta.instalacao_agendada && !temInstalacao;
  const temVistoriaBase = !!proposta.vistoria_base_info;

  // Verificar campos obrigatórios do veículo
  const faltaRenavam = !proposta.veiculo_renavam && !veiculoRenavam;
  const faltaChassi = !proposta.veiculo_chassi && !veiculoChassi;

  return (
    <Tabs defaultValue="cliente" className="w-full">
      <TabsList className="w-full grid grid-cols-2 sm:grid-cols-5 h-auto gap-1 bg-muted/50 p-1">
        <TabsTrigger value="cliente" className="gap-1.5 text-xs sm:text-sm">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Cliente</span>
        </TabsTrigger>
        <TabsTrigger value="veiculo" className="gap-1.5 text-xs sm:text-sm relative">
          <Car className="h-4 w-4" />
          <span className="hidden sm:inline">Veículo</span>
          {(faltaRenavam || faltaChassi) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full" />
          )}
        </TabsTrigger>
        <TabsTrigger value="documentos" className="gap-1.5 text-xs sm:text-sm relative">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Docs</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {totalDocumentos}
          </Badge>
          {documentosNovos > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          )}
        </TabsTrigger>
        <TabsTrigger value="instalacao" className="gap-1.5 text-xs sm:text-sm">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Instalação</span>
        </TabsTrigger>
        <TabsTrigger value="contrato" className="gap-1.5 text-xs sm:text-sm">
          <FileCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Contrato</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab Cliente */}
      <TabsContent value="cliente" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 sm:grid-cols-2">
            <InfoRow
              icon={User}
              label="Nome Completo"
              value={proposta.cliente_nome || associado?.nome}
              highlight
              iconColor="text-primary"
            />
            <InfoRow
              icon={FileText}
              label="CPF"
              value={maskCPF(proposta.cliente_cpf || associado?.cpf)}
              iconColor="text-primary"
            />
            <InfoRow
              icon={Phone}
              label="Telefone"
              value={proposta.cliente_telefone || associado?.telefone}
              iconColor="text-primary"
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={proposta.cliente_email || associado?.email}
              iconColor="text-primary"
            />
            <div className="sm:col-span-2">
              <InfoRow
                icon={MapPin}
                label="Endereço"
                value={
                  associado?.logradouro
                    ? `${associado.logradouro}, ${associado.numero || 'S/N'} - ${associado.bairro || ''}, ${associado.cidade || ''} - ${associado.uf || ''}`
                    : proposta.endereco_completo || null
                }
                iconColor="text-primary"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Veículo */}
      <TabsContent value="veiculo" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5 text-purple-500" />
              Dados do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1 sm:grid-cols-2">
              <InfoRow
                icon={Car}
                label="Modelo/Marca"
                value={`${proposta.veiculo_modelo || '---'} ${proposta.veiculo_marca || ''}`}
                highlight
                iconColor="text-purple-500"
              />
              <InfoRow
                icon={FileText}
                label="Placa"
                value={proposta.veiculo_placa}
                iconColor="text-purple-500"
              />
              <InfoRow
                icon={Calendar}
                label="Ano"
                value={proposta.veiculo_ano?.toString()}
                iconColor="text-purple-500"
              />
              <InfoRow
                icon={FileText}
                label="Cor"
                value={proposta.veiculo_cor}
                iconColor="text-purple-500"
              />
            </div>
            
            {/* Alerta de campos obrigatórios */}
            {(faltaRenavam || faltaChassi) && (
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-warning">Campos obrigatórios para SGA Hinova</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Preencha {[faltaRenavam && 'RENAVAM', faltaChassi && 'CHASSI'].filter(Boolean).join(' e ')} para enviar ao SGA.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Campos editáveis */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  RENAVAM
                </Label>
                {proposta.veiculo_renavam ? (
                  <p className="text-sm font-medium text-foreground h-9 flex items-center">
                    {proposta.veiculo_renavam}
                  </p>
                ) : (
                  <Input
                    type="text"
                    value={veiculoRenavam}
                    onChange={(e) => setVeiculoRenavam(e.target.value.replace(/\D/g, ''))}
                    placeholder="Digite o RENAVAM"
                    maxLength={11}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  CHASSI
                </Label>
                {proposta.veiculo_chassi ? (
                  <p className="text-sm font-medium text-foreground h-9 flex items-center">
                    {proposta.veiculo_chassi}
                  </p>
                ) : (
                  <Input
                    type="text"
                    value={veiculoChassi}
                    onChange={(e) => setVeiculoChassi(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="Digite o CHASSI"
                    maxLength={17}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Documentos */}
      <TabsContent value="documentos" className="mt-4 space-y-4">
        {/* Documentos Anexados */}
        <DocumentosAnexadosPanel
          documentos={(proposta.documentos || []) as unknown as DocumentoAnexadoCompleto[]}
          onViewDocumento={onViewDocumento}
        />
      </TabsContent>

      {/* Tab Instalação */}
      <TabsContent value="instalacao" className="mt-4 space-y-4">
        {/* Agendamento pendente */}
        {temAgendamento && (
          <Card className="border-2 border-info/30">
            <CardHeader className="pb-3 bg-info/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-info" />
                Instalação Agendada
              </CardTitle>
              <CardDescription>
                Agendamento realizado pelo cliente após pagamento da adesão
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-1 sm:grid-cols-2">
                <InfoRow
                  icon={Calendar}
                  label="Data Agendada"
                  value={format(new Date(proposta.instalacao_agendada!.data), "dd/MM/yyyy", { locale: ptBR })}
                  highlight
                  iconColor="text-info"
                />
                <InfoRow
                  icon={Clock}
                  label="Horário"
                  value={proposta.instalacao_agendada!.horario}
                  iconColor="text-info"
                />
              </div>
              
              {proposta.instalacao_agendada?.permite_encaixe && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="p-2 rounded-full bg-primary/20">
                    <Puzzle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-primary">Encaixe Permitido</span>
                    <p className="text-sm text-muted-foreground">
                      Cliente autorizou atendimento antecipado se houver vistoriador próximo
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vistoria na Base */}
        {temVistoriaBase && (
          <Card className="border-2 border-success/30">
            <CardHeader className="pb-3 bg-success/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-success" />
                Vistoria na Base
              </CardTitle>
              <CardDescription>
                Cliente compareceu à base PRATIC para realizar a vistoria presencial
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 grid gap-1 sm:grid-cols-2">
              <InfoRow
                icon={Calendar}
                label="Data da Vistoria"
                value={format(new Date(proposta.vistoria_base_info!.data_agendada + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                highlight
                iconColor="text-success"
              />
              <InfoRow
                icon={Clock}
                label="Horário"
                value={proposta.vistoria_base_info!.horario}
                iconColor="text-success"
              />
              <InfoRow
                icon={User}
                label="Atendido por"
                value={proposta.vistoria_base_info!.atendido_por_nome}
                iconColor="text-success"
              />
              <div className="flex items-center">
                <Badge className="bg-success/20 text-success border-success/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Vistoria Realizada
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instalação Realizada */}
        {temInstalacao && (
          <Card className="border-2 border-purple-500/30">
            <CardHeader className="pb-3 bg-purple-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wifi className="h-5 w-5 text-purple-500" />
                Dados da Instalação
              </CardTitle>
              <CardDescription>
                Informações preenchidas pelo instalador durante a instalação do rastreador
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 grid gap-1 sm:grid-cols-2">
              <InfoRow
                icon={Smartphone}
                label="IMEI do Rastreador"
                value={proposta.instalacao_info!.rastreador_imei}
                highlight
                iconColor="text-blue-500"
              />
              <InfoRow
                icon={Hash}
                label="Código do Rastreador"
                value={proposta.instalacao_info!.rastreador_codigo}
                iconColor="text-blue-500"
              />
              <InfoRow
                icon={Calendar}
                label="Data da Instalação"
                value={
                  proposta.instalacao_info!.concluida_em
                    ? format(new Date(proposta.instalacao_info!.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : null
                }
                iconColor="text-blue-500"
              />
              <InfoRow
                icon={Wrench}
                label="Instalador Responsável"
                value={proposta.instalacao_info!.instalador_nome}
                iconColor="text-blue-500"
              />
            </CardContent>
          </Card>
        )}

        {/* Sem dados de instalação */}
        {!temAgendamento && !temVistoriaBase && !temInstalacao && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Nenhuma informação de instalação</p>
              <p className="text-sm">Os dados aparecerão aqui após o agendamento ou instalação</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Tab Contrato */}
      <TabsContent value="contrato" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-500" />
              Dados do Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 sm:grid-cols-2">
            <InfoRow
              icon={FileText}
              label="Número do Contrato"
              value={proposta.numero}
              iconColor="text-emerald-500"
            />
            <InfoRow
              icon={FileCheck}
              label="Plano Escolhido"
              value={proposta.plano?.nome || proposta.plano_nome}
              highlight
              iconColor="text-emerald-500"
            />
            <InfoRow
              icon={DollarSign}
              label="Valor Mensal"
              value={formatCurrency(proposta.valor_mensal)}
              highlight
              iconColor="text-emerald-500"
            />
            <InfoRow
              icon={Calendar}
              label="Data de Assinatura"
              value={
                proposta.data_assinatura
                  ? format(new Date(proposta.data_assinatura), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : null
              }
              iconColor="text-emerald-500"
            />
            <InfoRow
              icon={User}
              label="Vendedor"
              value={proposta.vendedor?.nome}
              iconColor="text-emerald-500"
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
