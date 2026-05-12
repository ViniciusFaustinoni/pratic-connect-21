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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PropostaPendente } from '@/hooks/usePropostasPendentes';
import { formatPeriodoLabel } from '@/lib/periodo-utils';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

// Categoria de "situação especial" (taxi/leilão/aplicativo/etc.) — não confundir
// com tipo de veículo (moto vs automóvel). Ver
// mem://logic/operations/cotacao-categoria-vs-tipo-veiculo
const SITUACAO_ESPECIAL_VALUES = new Set([
  'chassi_remarcado', 'placa_vermelha', 'aplicativo', 'leilao',
  'ressarcimento_integral', 'ex_taxi', 'taxi',
]);

function rotuloCategoriaVeiculo(
  categoriaRaw: string | null | undefined,
  marca: string | null | undefined,
  modelo: string | null | undefined,
): string {
  const cat = (categoriaRaw || '').trim();
  if (cat && SITUACAO_ESPECIAL_VALUES.has(cat.toLowerCase())) {
    // Situação especial real → mostra como veio
    return cat;
  }
  const tipo = detectarTipoVeiculo(undefined, modelo, marca);
  return tipo === 'moto' ? 'Motocicleta' : 'Automóvel';
}
import { normalizeChassi, chassiHelperText, isValidChassi } from '@/lib/chassi';

interface PropostaDetalhesTabsProps {
  proposta: PropostaPendente;
  veiculoRenavam: string;
  setVeiculoRenavam: (value: string) => void;
  veiculoChassi: string;
  setVeiculoChassi: (value: string) => void;
}

// Componente de campo com hover highlight
function FichaField({
  icon: Icon,
  label,
  value,
  highlight,
  iconColor = 'text-muted-foreground',
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
  iconColor?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/50 transition-colors hover:bg-muted/60",
      className
    )}>
      <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn(
          "text-sm text-foreground truncate", 
          highlight && "font-semibold"
        )}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Cores de borda superior por categoria
const categoryBorderColors: Record<string, string> = {
  cliente: 'border-t-primary',
  veiculo: 'border-t-purple-500',
  contrato: 'border-t-emerald-500',
  instalacao: 'border-t-info',
};

export function PropostaDetalhesTabs({
  proposta,
  veiculoRenavam,
  setVeiculoRenavam,
  veiculoChassi,
  setVeiculoChassi,
}: PropostaDetalhesTabsProps) {
  const associado = proposta.associado;
  
  const temInstalacao = !!proposta.instalacao_info;
  const temAgendamento = !!proposta.instalacao_agendada && !temInstalacao;
  const temVistoriaBase = !!proposta.vistoria_base_info;

  const faltaRenavam = !proposta.veiculo_renavam && !veiculoRenavam;
  const faltaChassi = !proposta.veiculo_chassi && !veiculoChassi;

  return (
    <Tabs defaultValue="cliente" className="w-full">
      {/* Sticky tabs bar - labels sempre visíveis */}
      <div className="sticky top-[41px] z-10 bg-background/95 backdrop-blur-sm pb-2 pt-1 -mx-1 px-1">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="cliente" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg">
            <User className="h-3.5 w-3.5" />
            <span>Cliente</span>
          </TabsTrigger>
          <TabsTrigger value="veiculo" className="gap-1.5 text-xs relative data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg">
            <Car className="h-3.5 w-3.5" />
            <span>Veículo</span>
            {(faltaRenavam || faltaChassi) && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-warning text-[8px] text-warning-foreground font-bold flex items-center justify-center">!</span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="instalacao" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg">
            <Wrench className="h-3.5 w-3.5" />
            <span>Instal.</span>
          </TabsTrigger>
          <TabsTrigger value="contrato" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg">
            <FileCheck className="h-3.5 w-3.5" />
            <span>Contrato</span>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Tab Cliente */}
      <TabsContent value="cliente" className="mt-3">
        <Card className={cn("border-border rounded-xl border-t-2", categoryBorderColors.cliente)}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <User className="h-4 w-4" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <FichaField icon={User} label="Nome Completo" value={proposta.cliente_nome || associado?.nome} highlight iconColor="text-primary" />
              <FichaField icon={FileText} label="CPF" value={maskCPF(proposta.cliente_cpf || associado?.cpf)} iconColor="text-primary" />
              <FichaField icon={Phone} label="Telefone" value={proposta.cliente_telefone || associado?.telefone} iconColor="text-primary" />
              <FichaField icon={Phone} label="WhatsApp / Secundário" value={associado?.whatsapp || associado?.telefone_secundario} iconColor="text-primary" />
              <FichaField icon={Mail} label="Email" value={proposta.cliente_email || associado?.email} iconColor="text-primary" className="sm:col-span-2" />
              <FichaField
                icon={MapPin}
                label="Endereço"
                value={
                  associado?.logradouro
                    ? `${associado.logradouro}, ${associado.numero || 'S/N'} - ${associado.bairro || ''}, ${associado.cidade || ''} - ${associado.uf || ''}`
                    : proposta.endereco_completo || null
                }
                iconColor="text-primary"
                className="sm:col-span-2"
              />
              <FichaField icon={Calendar} label="Data de Nascimento" value={associado?.data_nascimento ? format(new Date(associado.data_nascimento + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR }) : null} iconColor="text-primary" />
              <FichaField icon={User} label="Estado Civil" value={associado?.estado_civil} iconColor="text-primary" />
              <FichaField icon={User} label="Profissão" value={associado?.profissao} iconColor="text-primary" />
              <FichaField icon={FileText} label="RG" value={associado?.rg} iconColor="text-primary" />
            </div>

            {/* Bloco CNH */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">CNH</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <FichaField icon={FileText} label="Número CNH" value={associado?.cnh_numero} iconColor="text-primary" />
                <FichaField icon={FileText} label="Categoria" value={associado?.cnh_categoria} iconColor="text-primary" />
                <FichaField icon={Calendar} label="Validade" value={associado?.cnh_validade ? format(new Date(associado.cnh_validade + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR }) : null} iconColor="text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Veículo */}
      <TabsContent value="veiculo" className="mt-3">
        <Card className={cn("border-border rounded-xl border-t-2", categoryBorderColors.veiculo)}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-500">
              <Car className="h-4 w-4" />
              Dados do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <FichaField icon={Car} label="Modelo/Marca" value={`${proposta.veiculo_modelo || '---'} ${proposta.veiculo_marca || ''}`} highlight iconColor="text-purple-500" />
              <FichaField icon={FileText} label="Placa" value={proposta.veiculo_placa} iconColor="text-purple-500" />
              <FichaField icon={Calendar} label="Ano Modelo" value={proposta.veiculo_ano?.toString()} iconColor="text-purple-500" />
              <FichaField icon={Calendar} label="Ano Fabricação" value={proposta.veiculo_ano_fabricacao?.toString()} iconColor="text-purple-500" />
              <FichaField icon={FileText} label="Cor" value={proposta.veiculo_cor} iconColor="text-purple-500" />
              <FichaField icon={FileText} label="Combustível" value={proposta.veiculo_combustivel} iconColor="text-purple-500" />
              <FichaField icon={FileText} label="Categoria" value={rotuloCategoriaVeiculo(proposta.veiculo_categoria, proposta.veiculo_marca, proposta.veiculo_modelo)} iconColor="text-purple-500" />
              <FichaField icon={FileText} label="Tipo de Uso" value={proposta.veiculo_tipo_uso} iconColor="text-purple-500" />
              <FichaField icon={FileText} label="Procedência" value={proposta.veiculo_procedencia} iconColor="text-purple-500" />
            </div>

            {/* Bloco FIPE / Cobertura */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">FIPE & Cobertura</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <FichaField icon={DollarSign} label="Valor FIPE" value={formatCurrency(proposta.veiculo_valor_fipe)} highlight iconColor="text-emerald-500" />
                <FichaField icon={Hash} label="Código FIPE" value={proposta.codigo_fipe} iconColor="text-purple-500" />
                <FichaField icon={DollarSign} label="Cobertura" value={formatCurrency(proposta.cobertura_fipe)} iconColor="text-emerald-500" />
              </div>
            </div>

            {/* Status especiais */}
            {(proposta.veiculo_alienado || proposta.veiculo_blindado || proposta.veiculo_financeira || proposta.veiculo_cobertura_total || proposta.uso_aplicativo) && (
              <div className="border-t border-border/50 pt-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Características especiais</p>
                <div className="flex flex-wrap gap-2">
                  {proposta.veiculo_alienado && (
                    <Badge variant="outline" className="text-warning border-warning/40 bg-warning/10">Alienado</Badge>
                  )}
                  {proposta.veiculo_blindado && (
                    <Badge variant="outline" className="text-info border-info/40 bg-info/10">Blindado</Badge>
                  )}
                  {proposta.uso_aplicativo && (
                    <Badge variant="outline" className="text-info border-info/40 bg-info/10">Uso APP</Badge>
                  )}
                  {proposta.veiculo_cobertura_total && (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 bg-emerald-500/10">Cobertura Total</Badge>
                  )}
                  {proposta.veiculo_financeira && (
                    <Badge variant="outline" className="text-purple-500 border-purple-500/40 bg-purple-500/10">
                      Financeira: {proposta.veiculo_financeira}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {(faltaRenavam || faltaChassi) && (
              <div className="rounded-xl border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning">Campos obrigatórios para SGA Hinova</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Preencha {[faltaRenavam && 'RENAVAM', faltaChassi && 'CHASSI'].filter(Boolean).join(' e ')}.
                  </p>
                </div>
              </div>
            )}
            
            {/* Separador visual */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Dados complementares</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">RENAVAM</Label>
                  {proposta.veiculo_renavam ? (
                    <p className="text-sm font-medium text-foreground h-9 flex items-center px-3 bg-muted/30 rounded-lg border border-border/50">{proposta.veiculo_renavam}</p>
                  ) : (
                    <Input type="text" value={veiculoRenavam} onChange={(e) => setVeiculoRenavam(e.target.value.replace(/\D/g, ''))} placeholder="Digite o RENAVAM" maxLength={11} className="h-9 rounded-lg" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">CHASSI</Label>
                  {proposta.veiculo_chassi ? (
                    <p className="text-sm font-medium text-foreground h-9 flex items-center px-3 bg-muted/30 rounded-lg border border-border/50">{proposta.veiculo_chassi}</p>
                  ) : (
                    <>
                      <Input
                        type="text"
                        value={veiculoChassi}
                        onChange={(e) => setVeiculoChassi(normalizeChassi(e.target.value))}
                        placeholder="Digite o CHASSI (17 caracteres)"
                        maxLength={17}
                        className={cn(
                          "h-9 rounded-lg font-mono uppercase",
                          veiculoChassi && !isValidChassi(veiculoChassi) && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={cn(
                          "text-muted-foreground",
                          veiculoChassi && !isValidChassi(veiculoChassi) && "text-destructive"
                        )}>
                          {chassiHelperText(veiculoChassi) || 'Padrão VIN: 17 caracteres, sem I, O ou Q.'}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{veiculoChassi.length}/17</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Instalação */}
      <TabsContent value="instalacao" className="mt-3 space-y-3">
        {temAgendamento && (
          <Card className={cn("border rounded-xl border-t-2", categoryBorderColors.instalacao, "border-info/30")}>
            <CardHeader className="pb-2 pt-4 px-4 bg-info/5 rounded-t-xl">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-info">
                <Calendar className="h-4 w-4" />
                Instalação Agendada
              </CardTitle>
              <CardDescription className="text-xs">Agendamento pelo cliente após pagamento da adesão</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <FichaField icon={Calendar} label="Data Agendada" value={format(new Date(proposta.instalacao_agendada!.data), "dd/MM/yyyy", { locale: ptBR })} highlight iconColor="text-info" />
                <FichaField icon={Clock} label="Período" value={formatPeriodoLabel(proposta.instalacao_agendada!.horario)} iconColor="text-info" />
              </div>
              {proposta.instalacao_agendada?.permite_encaixe && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/30 mt-2">
                  <Puzzle className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Encaixe Permitido</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {temVistoriaBase && (
          <Card className="border border-success/30 rounded-xl border-t-2 border-t-success">
            <CardHeader className="pb-2 pt-4 px-4 bg-success/5 rounded-t-xl">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-success">
                <Building2 className="h-4 w-4" />
                Vistoria na Base
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <FichaField icon={Calendar} label="Data" value={format(new Date(proposta.vistoria_base_info!.data_agendada + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })} highlight iconColor="text-success" />
                <FichaField icon={Clock} label="Período" value={formatPeriodoLabel(proposta.vistoria_base_info!.horario)} iconColor="text-success" />
                <FichaField icon={User} label="Atendido por" value={proposta.vistoria_base_info!.atendido_por_nome} iconColor="text-success" />
                <div className="flex items-center px-3">
                  <Badge className="bg-success/20 text-success border-success/30 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Vistoria Realizada
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {temInstalacao && (
          <Card className="border border-purple-500/30 rounded-xl border-t-2 border-t-purple-500">
            <CardHeader className="pb-2 pt-4 px-4 bg-purple-500/5 rounded-t-xl">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-500">
                <Wifi className="h-4 w-4" />
                Dados da Instalação
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-2 grid gap-2 sm:grid-cols-2">
              <FichaField icon={Smartphone} label="IMEI" value={proposta.instalacao_info!.rastreador_imei} highlight iconColor="text-blue-500" />
              <FichaField icon={Hash} label="Código" value={proposta.instalacao_info!.rastreador_codigo} iconColor="text-blue-500" />
              <FichaField icon={Calendar} label="Data" value={proposta.instalacao_info!.concluida_em ? format(new Date(proposta.instalacao_info!.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null} iconColor="text-blue-500" />
              <FichaField icon={Wrench} label="Instalador" value={proposta.instalacao_info!.instalador_nome} iconColor="text-blue-500" />
            </CardContent>
          </Card>
        )}

        {!temAgendamento && !temVistoriaBase && !temInstalacao && (
          <Card className="rounded-xl">
            <CardContent className="py-10 text-center text-muted-foreground">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Wrench className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="font-semibold text-sm text-foreground">Nenhuma informação de instalação</p>
              <p className="text-xs mt-1">Os dados aparecerão aqui após o agendamento</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Tab Contrato */}
      <TabsContent value="contrato" className="mt-3">
        <Card className={cn("border-border rounded-xl border-t-2", categoryBorderColors.contrato)}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-500">
              <FileCheck className="h-4 w-4" />
              Dados do Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 grid gap-2 sm:grid-cols-2">
            <FichaField icon={FileText} label="Número do Contrato" value={proposta.numero} iconColor="text-emerald-500" />
            <FichaField icon={FileCheck} label="Plano" value={proposta.plano?.nome || proposta.plano_nome} highlight iconColor="text-emerald-500" />
            <FichaField icon={DollarSign} label="Valor Mensal" value={formatCurrency(proposta.valor_mensal)} highlight iconColor="text-emerald-500" />
            <FichaField icon={DollarSign} label="Valor Adesão" value={formatCurrency(proposta.valor_adesao)} iconColor="text-emerald-500" />
            <FichaField icon={Calendar} label="Dia de Vencimento" value={proposta.dia_vencimento ? `Todo dia ${proposta.dia_vencimento}` : null} iconColor="text-emerald-500" />
            <FichaField icon={Calendar} label="Data de Assinatura" value={proposta.data_assinatura ? format(new Date(proposta.data_assinatura), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : null} iconColor="text-emerald-500" />
            <FichaField icon={User} label="Vendedor" value={proposta.vendedor?.nome} iconColor="text-emerald-500" />
            <FichaField icon={FileText} label="Cenário Adesão" value={proposta.cenario_adesao} iconColor="text-emerald-500" />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
