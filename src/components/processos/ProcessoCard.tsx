import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Car, User, Calendar, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type BadgeTone =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

export interface ProcessoCardBadge {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
}

export interface ProcessoCardExtraAction {
  icon: LucideIcon;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}

export interface ProcessoCardData {
  id: string;
  statusBadge: ProcessoCardBadge;
  badgesExtra?: ProcessoCardBadge[];
  associado: { nome: string; cpf?: string | null };
  contraparte?: { nome: string };
  veiculo?: {
    marca?: string | null;
    modelo?: string | null;
    ano?: number | string | null;
    placa?: string | null;
    extra?: string; // ex: " → Veículo novo · placa"
  };
  consultor?: { nome: string };
  infoLinhas?: string[]; // linhas extras (ex: "FIPE R$ … · Mensalidade R$ …")
  criadoEm?: string | null;
  criadoLabel?: string; // default "Criada em"
  motivoReprovacao?: string | null;
  onDetalhes?: () => void;
  detalhesLabel?: string;
  acoesExtras?: ProcessoCardExtraAction[];
}

function toneToBadgeClass(tone?: BadgeTone): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
} {
  switch (tone) {
    case 'success':
      return { variant: 'outline', className: 'text-green-600 border-green-600' };
    case 'warning':
      return { variant: 'outline', className: 'text-amber-600 border-amber-600' };
    case 'info':
      return { variant: 'outline', className: 'text-blue-600 border-blue-600' };
    case 'destructive':
      return { variant: 'destructive' };
    case 'secondary':
      return { variant: 'secondary' };
    case 'outline':
      return { variant: 'outline' };
    default:
      return { variant: 'default' };
  }
}

function RenderBadge({ b }: { b: ProcessoCardBadge }) {
  const { variant, className } = toneToBadgeClass(b.tone);
  const Icon = b.icon;
  return (
    <Badge variant={variant} className={cn(className)}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {b.label}
    </Badge>
  );
}

export function ProcessoCard({ data }: { data: ProcessoCardData }) {
  const clickable = !!data.onDetalhes;
  return (
    <Card
      className={cn(
        'transition',
        clickable && 'hover:shadow-md cursor-pointer'
      )}
      onClick={data.onDetalhes}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <RenderBadge b={data.statusBadge} />
              {data.badgesExtra?.map((b, i) => (
                <RenderBadge key={i} b={b} />
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-medium">{data.associado.nome}</span>
              {data.associado.cpf && (
                <span className="text-xs text-muted-foreground">
                  · CPF {data.associado.cpf}
                </span>
              )}
              {data.contraparte && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{data.contraparte.nome}</span>
                </>
              )}
            </div>

            {data.veiculo && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Car className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {[data.veiculo.marca, data.veiculo.modelo, data.veiculo.ano]
                    .filter(Boolean)
                    .join(' ')}
                  {data.veiculo.placa ? ` · Placa ${data.veiculo.placa}` : ''}
                  {data.veiculo.extra || ''}
                </span>
              </div>
            )}

            {data.infoLinhas?.map((linha, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                {linha}
              </div>
            ))}

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {data.consultor && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Consultor: <span className="font-medium text-foreground">{data.consultor.nome}</span>
                </span>
              )}
              {data.criadoEm && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {data.criadoLabel || 'Criada em'}{' '}
                  {format(new Date(data.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>

            {data.motivoReprovacao && (
              <p className="text-xs text-destructive">
                Motivo: {data.motivoReprovacao}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {data.acoesExtras?.map((a, i) => (
              <Button
                key={i}
                variant="ghost"
                size="icon"
                title={a.title}
                onClick={(e) => {
                  e.stopPropagation();
                  a.onClick(e);
                }}
              >
                <a.icon className="h-4 w-4" />
              </Button>
            ))}
            {data.onDetalhes && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onDetalhes!();
                }}
              >
                {data.detalhesLabel || 'Detalhes'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcessoCardList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}
