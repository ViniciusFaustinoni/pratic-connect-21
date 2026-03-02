import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ResolverRecusaDialog } from '@/components/cadastro/ResolverRecusaDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  User,
  Car,
  Wifi,
  Calendar,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Zap,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useVistoriaCompletaAnalise } from '@/hooks/useVistoriaCompletaAnalise';
import { StatusCoberturaCard } from '@/components/cadastro/StatusCoberturaCard';

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

// ============================================
// COMPONENTE: Info Item
// ============================================
function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-foreground', highlight && 'font-semibold text-lg')}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function VistoriaCompletaAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showConfirmAtivacao, setShowConfirmAtivacao] = useState(false);
  const [showRecusaDialog, setShowRecusaDialog] = useState(false);

  const {
    instalacao,
    isLoading,
    error,
    podeAtivar,
    ativarRastreador,
    isAtivando,
  } = useVistoriaCompletaAnalise(id);

  // Query para buscar dados de recusa do serviço vinculado à instalação
  const { data: servicoRecusa } = useQuery({
    queryKey: ['servico-recusa-instalacao', id],
    queryFn: async () => {
      if (!id) return null;
      // Buscar serviço de instalação vinculado que tenha decisao_instalador = 'negado'
      const { data } = await supabase
        .from('servicos')
        .select('id, decisao_instalador, ressalvas_instalador, fotos_ressalva, veiculo_id, associado_id')
        .eq('tipo', 'instalacao')
        .eq('decisao_instalador', 'negado')
        .limit(1);
      
      // Filtrar pelo veículo da instalação se disponível
      if (!data || data.length === 0) return null;
      return data[0];
    },
    enabled: !!id && !!instalacao,
  });

  const temRecusaPendente = servicoRecusa?.decisao_instalador === 'negado';

  const handleAtivarRastreador = () => {
    setShowConfirmAtivacao(true);
  };

  const handleConfirmarAtivacao = async () => {
    setShowConfirmAtivacao(false);
    await ativarRastreador();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <Skeleton className="h-64 w-full bg-muted" />
            <Skeleton className="h-64 w-full bg-muted" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full bg-muted" />
            <Skeleton className="h-48 w-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !instalacao) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Instalação não encontrada</h2>
        <p className="text-muted-foreground mt-2">
          A instalação solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const { associados, veiculos, rastreadores, instalador } = instalacao;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Ativação de Rastreador
            </h1>
            <p className="text-muted-foreground">
              Instalação #{id?.slice(0, 8)} • {veiculos?.placa}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <Badge
          className={cn(
            'text-sm px-3 py-1',
            instalacao.status === 'concluida'
              ? 'bg-success/20 text-success border-success'
              : 'bg-warning/20 text-warning border-warning'
          )}
        >
          {instalacao.status === 'concluida' ? 'Instalação Concluída' : instalacao.status}
        </Badge>
      </div>

      {/* BANNER DE RECUSA DO INSTALADOR */}
      {temRecusaPendente && servicoRecusa && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive text-lg">
                  Veículo NEGADO pelo Instalador — Pendente de Revisão
                </h3>
                {servicoRecusa.ressalvas_instalador && (
                  <p className="text-sm text-foreground mt-1">
                    <strong>Motivo:</strong> {servicoRecusa.ressalvas_instalador}
                  </p>
                )}
                {servicoRecusa.fotos_ressalva && (servicoRecusa.fotos_ressalva as string[]).length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(servicoRecusa.fotos_ressalva as string[]).map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Evidência ${i + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                      </a>
                    ))}
                  </div>
                )}
                <Button
                  className="mt-3"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowRecusaDialog(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Tomar Decisão
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CONTEÚDO */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* COLUNA ESQUERDA - 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Dados do Cliente */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <User className="h-5 w-5 text-purple-500" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={User}
                label="Nome Completo"
                value={associados?.nome}
                highlight
              />
              <InfoItem
                icon={FileText}
                label="CPF"
                value={maskCPF(associados?.cpf || null)}
              />
              <InfoItem icon={Phone} label="Telefone" value={associados?.telefone} />
              <InfoItem icon={Mail} label="Email" value={associados?.email} />
            </CardContent>
          </Card>

          {/* Dados do Veículo */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Car className="h-5 w-5 text-purple-500" />
                Dados do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={Car}
                label="Modelo/Marca"
                value={`${veiculos?.modelo || '---'} ${veiculos?.marca || ''}`}
                highlight
              />
              <InfoItem icon={FileText} label="Placa" value={veiculos?.placa} />
              <InfoItem
                icon={Calendar}
                label="Ano"
                value={veiculos?.ano_modelo?.toString()}
              />
              <InfoItem icon={MapPin} label="Chassi" value={veiculos?.chassi} />
            </CardContent>
          </Card>

          {/* Dados do Rastreador */}
          {rastreadores && (
            <Card className="border-border bg-card border-2 border-purple-500/30">
              <CardHeader className="bg-purple-500/10">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Wifi className="h-5 w-5 text-purple-500" />
                  Dados do Rastreador
                </CardTitle>
                <CardDescription>
                  Dispositivo instalado no veículo
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={Wifi}
                  label="IMEI"
                  value={rastreadores.imei}
                  highlight
                />
                <InfoItem
                  icon={FileText}
                  label="Código"
                  value={rastreadores.codigo}
                />
                <InfoItem
                  icon={FileText}
                  label="Número de Série"
                  value={rastreadores.numero_serie}
                />
                <InfoItem
                  icon={Zap}
                  label="Plataforma"
                  value={rastreadores.plataforma?.toUpperCase()}
                />
                <InfoItem
                  icon={FileText}
                  label="Status"
                  value={rastreadores.status}
                />
                <InfoItem
                  icon={FileText}
                  label="Device ID (Plataforma)"
                  value={rastreadores.plataforma_device_id || 'Não sincronizado'}
                />
              </CardContent>
            </Card>
          )}

          {/* Dados da Instalação */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-purple-500" />
                Dados da Instalação
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={Calendar}
                label="Data de Conclusão"
                value={
                  instalacao.concluida_em
                    ? format(new Date(instalacao.concluida_em), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })
                    : null
                }
              />
              <InfoItem
                icon={User}
                label="Instalador Responsável"
                value={instalador?.nome}
              />
              {instalacao.observacoes && (
                <div className="sm:col-span-2">
                  <InfoItem
                    icon={FileText}
                    label="Observações"
                    value={instalacao.observacoes}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA - 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status de Cobertura */}
          <StatusCoberturaCard
            coberturaRouboFurto={veiculos?.cobertura_roubo_furto || false}
            coberturaTotal={veiculos?.cobertura_total || false}
            rastreadorVinculado={!!rastreadores}
            rastreadorImei={rastreadores?.imei}
            rastreadorCodigo={rastreadores?.codigo}
            instalacaoStatus={instalacao.status}
          />

          {/* Ações */}
          {temRecusaPendente ? (
            <Card className="border-destructive/50 bg-card">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="font-medium text-destructive">Ativação Bloqueada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Veículo negado pelo instalador. Resolva a pendência antes de ativar.
                </p>
                <Button variant="destructive" className="mt-3" onClick={() => setShowRecusaDialog(true)}>
                  Tomar Decisão
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Ações</CardTitle>
                <CardDescription>
                  {podeAtivar
                    ? 'Clique para ativar o rastreador na plataforma e liberar a Proteção 360º'
                    : veiculos?.cobertura_total
                    ? 'Rastreador já ativado - Proteção 360º liberada'
                    : 'Ativação não disponível no momento'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {podeAtivar ? (
                  <Button
                    className="w-full bg-success hover:bg-success/90 text-white"
                    size="lg"
                    onClick={handleAtivarRastreador}
                    disabled={isAtivando}
                  >
                    {isAtivando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ativando...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Ativar Rastreador
                      </>
                    )}
                  </Button>
                ) : veiculos?.cobertura_total ? (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/30 text-center">
                    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                    <p className="font-medium text-success">Rastreador Ativado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Proteção 360º liberada para este veículo
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted text-center">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="font-medium text-muted-foreground">
                      Ativação Indisponível
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {!rastreadores
                        ? 'Nenhum rastreador vinculado'
                        : !veiculos?.cobertura_roubo_furto
                        ? 'Cobertura roubo/furto não aprovada'
                        : 'Instalação não concluída'}
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Confirmação de Ativação */}
      <AlertDialog open={showConfirmAtivacao} onOpenChange={setShowConfirmAtivacao}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Confirmar Ativação do Rastreador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação irá:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Ativar o rastreador na plataforma {rastreadores?.plataforma?.toUpperCase()}</li>
                <li>Liberar a Proteção 360º para o veículo {veiculos?.placa}</li>
                <li>Ativar o associado {associados?.nome}</li>
              </ul>
              <p className="mt-3 font-medium">Deseja continuar?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-success hover:bg-success/90 text-white"
              onClick={handleConfirmarAtivacao}
            >
              <Zap className="mr-2 h-4 w-4" />
              Confirmar Ativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Recusa do Instalador */}
      {servicoRecusa && (
        <ResolverRecusaDialog
          open={showRecusaDialog}
          onOpenChange={setShowRecusaDialog}
          servicoId={servicoRecusa.id}
          veiculoId={servicoRecusa.veiculo_id}
          associadoId={servicoRecusa.associado_id}
          placa={veiculos?.placa || ''}
          motivo={servicoRecusa.ressalvas_instalador}
          fotosRessalva={servicoRecusa.fotos_ressalva as string[] | null}
        />
      )}
    </div>
  );
}
