import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Phone, 
  MapPin, 
  Wrench, 
  Car,
  Fuel,
  Key,
  AlertTriangle,
  Flame,
  Droplets,
  Check,
  ChevronRight,
  Crown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LucideIcon } from 'lucide-react';

interface PlanoData {
  id?: string;
  codigo?: string;
  nome: string;
  descricao?: string | null;
  tipo_uso?: string;
  valor_adesao?: number;
}

interface BeneficioCobertura {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
}

interface CardPlanoProps {
  plano: PlanoData;
  dataAdesao?: string;
  valorMensal?: number;
  compacto?: boolean;
  mostrarBeneficios?: boolean;
  mostrarCoberturas?: boolean;
  onClick?: () => void;
}

const BENEFICIOS_POR_TIPO: Record<string, BeneficioCobertura[]> = {
  passeio: [
    { icone: Shield, titulo: 'Proteção 24h', descricao: 'Monitoramento contínuo' },
    { icone: Phone, titulo: 'Central de atendimento' },
    { icone: MapPin, titulo: 'Rastreamento em tempo real' },
    { icone: Wrench, titulo: 'Assistência mecânica' },
    { icone: Car, titulo: 'Carro reserva', descricao: 'Até 7 dias' },
  ],
  trabalho: [
    { icone: Shield, titulo: 'Proteção 24h', descricao: 'Monitoramento contínuo' },
    { icone: Phone, titulo: 'Central prioritário' },
    { icone: MapPin, titulo: 'Rastreamento em tempo real' },
    { icone: Wrench, titulo: 'Assistência mecânica ilimitada' },
    { icone: Car, titulo: 'Carro reserva', descricao: 'Até 15 dias' },
    { icone: Fuel, titulo: 'Pane seca', descricao: 'Até 10L' },
    { icone: Key, titulo: 'Chaveiro 24h' },
  ],
};

const COBERTURAS: BeneficioCobertura[] = [
  { icone: AlertTriangle, titulo: 'Roubo e Furto', descricao: '100% FIPE' },
  { icone: Flame, titulo: 'Incêndio', descricao: '100% FIPE' },
  { icone: Droplets, titulo: 'Alagamento', descricao: '100% FIPE' },
  { icone: Car, titulo: 'Perda Total', descricao: '100% FIPE' },
];

const CORES_POR_TIPO: Record<string, { bg: string; badge: string }> = {
  passeio: { bg: 'bg-blue-50 dark:bg-blue-950/30', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  trabalho: { bg: 'bg-purple-50 dark:bg-purple-950/30', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

export function CardPlano({
  plano,
  dataAdesao,
  valorMensal,
  compacto = false,
  mostrarBeneficios = true,
  mostrarCoberturas = true,
  onClick,
}: CardPlanoProps) {
  const tipoUso = plano.tipo_uso?.toLowerCase() || 'passeio';
  const beneficios = BENEFICIOS_POR_TIPO[tipoUso] || BENEFICIOS_POR_TIPO.passeio;
  const cores = CORES_POR_TIPO[tipoUso] || CORES_POR_TIPO.passeio;

  const formatDataAdesao = () => {
    if (!dataAdesao) return null;
    try {
      return format(new Date(dataAdesao), "MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return null;
    }
  };

  // Versão Compacta
  if (compacto) {
    return (
      <Card 
        className="border-0 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
        onClick={onClick}
      >
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cores.bg}`}>
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{plano.nome}</p>
                <Badge className={cores.badge} variant="secondary">
                  {tipoUso.charAt(0).toUpperCase() + tipoUso.slice(1)}
                </Badge>
              </div>
              {formatDataAdesao() && (
                <p className="text-sm text-muted-foreground">
                  Desde {formatDataAdesao()}
                </p>
              )}
            </div>
          </div>
          {onClick && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </CardContent>
      </Card>
    );
  }

  // Versão Completa
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className={`${cores.bg} pb-4`}>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Meu Plano</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Info do Plano */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">{plano.nome}</h3>
            {formatDataAdesao() && (
              <p className="text-sm text-muted-foreground">
                Associado desde {formatDataAdesao()}
              </p>
            )}
            {plano.descricao && (
              <p className="text-sm text-muted-foreground mt-1">{plano.descricao}</p>
            )}
          </div>
          <Badge className={cores.badge} variant="secondary">
            {tipoUso.charAt(0).toUpperCase() + tipoUso.slice(1)}
          </Badge>
        </div>

        {valorMensal && (
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Mensalidade</p>
            <p className="text-xl font-bold text-foreground">
              {valorMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        )}

        {/* Benefícios */}
        {mostrarBeneficios && beneficios.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Benefícios Inclusos
              </h4>
              <ul className="space-y-2">
                {beneficios.map((beneficio, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-foreground">{beneficio.titulo}</span>
                      {beneficio.descricao && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({beneficio.descricao})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Coberturas */}
        {mostrarCoberturas && COBERTURAS.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Coberturas
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {COBERTURAS.map((cobertura, index) => {
                  const IconeCobertura = cobertura.icone;
                  return (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 rounded-lg bg-muted p-2"
                    >
                      <IconeCobertura className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {cobertura.titulo}
                        </p>
                        {cobertura.descricao && (
                          <p className="text-xs text-muted-foreground">
                            {cobertura.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
