import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldOff, Wifi, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusCoberturaCardProps {
  coberturaRouboFurto: boolean | null;
  coberturaTotal: boolean | null;
  rastreadorVinculado: boolean;
  rastreadorImei?: string | null;
  rastreadorCodigo?: string | null;
  instalacaoStatus?: string | null;
  className?: string;
}

export function StatusCoberturaCard({
  coberturaRouboFurto,
  coberturaTotal,
  rastreadorVinculado,
  rastreadorImei,
  rastreadorCodigo,
  instalacaoStatus,
  className,
}: StatusCoberturaCardProps) {
  const aguardandoAtivacao = coberturaRouboFurto && !coberturaTotal && rastreadorVinculado;

  return (
    <Card className={cn('border-border bg-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Shield className="h-5 w-5 text-purple-500" />
          Status de Cobertura
        </CardTitle>
        <CardDescription>
          Níveis de proteção ativados para este veículo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cobertura Roubo/Furto */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {coberturaRouboFurto ? (
              <ShieldCheck className="h-5 w-5 text-success" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">Cobertura Roubo/Furto</p>
              <p className="text-sm text-muted-foreground">
                Proteção contra roubo e furto do veículo
              </p>
            </div>
          </div>
          <Badge
            variant={coberturaRouboFurto ? 'default' : 'secondary'}
            className={cn(
              coberturaRouboFurto
                ? 'bg-success/20 text-success border-success'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {coberturaRouboFurto ? 'Ativa' : 'Inativa'}
          </Badge>
        </div>

        {/* Cobertura Total */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {coberturaTotal ? (
              <ShieldCheck className="h-5 w-5 text-success" />
            ) : aguardandoAtivacao ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">Cobertura Total</p>
              <p className="text-sm text-muted-foreground">
                {aguardandoAtivacao
                  ? 'Rastreador precisa ser ativado na plataforma'
                  : 'Proteção completa com rastreamento ativo'}
              </p>
            </div>
          </div>
          <Badge
            variant={coberturaTotal ? 'default' : 'secondary'}
            className={cn(
              coberturaTotal
                ? 'bg-success/20 text-success border-success'
                : aguardandoAtivacao
                ? 'bg-warning/20 text-warning border-warning'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {coberturaTotal ? 'Ativa' : aguardandoAtivacao ? 'Aguardando Ativação' : 'Inativa'}
          </Badge>
        </div>

        {/* Status do Rastreador */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {rastreadorVinculado ? (
              <Wifi className="h-5 w-5 text-info" />
            ) : (
              <Wifi className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">Rastreador</p>
              <p className="text-sm text-muted-foreground">
                {rastreadorVinculado
                  ? `IMEI: ${rastreadorImei || '---'} | Código: ${rastreadorCodigo || '---'}`
                  : 'Nenhum rastreador vinculado'}
              </p>
            </div>
          </div>
          <Badge
            variant={rastreadorVinculado ? 'default' : 'secondary'}
            className={cn(
              rastreadorVinculado
                ? 'bg-info/20 text-info border-info'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {rastreadorVinculado ? 'Vinculado' : 'Pendente'}
          </Badge>
        </div>

        {/* Status da Instalação */}
        {instalacaoStatus && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <CheckCircle2
                className={cn(
                  'h-5 w-5',
                  instalacaoStatus === 'concluida'
                    ? 'text-success'
                    : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="font-medium text-foreground">Instalação</p>
                <p className="text-sm text-muted-foreground">
                  Status da instalação física do rastreador
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                instalacaoStatus === 'concluida'
                  ? 'bg-success/20 text-success border-success'
                  : instalacaoStatus === 'em_andamento'
                  ? 'bg-info/20 text-info border-info'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {instalacaoStatus === 'concluida'
                ? 'Concluída'
                : instalacaoStatus === 'em_andamento'
                ? 'Em Andamento'
                : instalacaoStatus === 'agendada'
                ? 'Agendada'
                : instalacaoStatus}
            </Badge>
          </div>
        )}

        {/* Alerta de Ativação Pendente */}
        {aguardandoAtivacao && (
          <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Ativação Pendente</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O rastreador foi instalado mas ainda não foi ativado na plataforma de rastreamento.
                  Use o botão "Ativar Rastreador" para sincronizar com a plataforma e liberar a cobertura total.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
