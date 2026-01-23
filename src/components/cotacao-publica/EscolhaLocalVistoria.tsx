import { Home, Building2, MapPin, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfiguracaoBase } from '@/hooks/useAgendamentoBase';
import { Skeleton } from '@/components/ui/skeleton';

interface EscolhaLocalVistoriaProps {
  onEscolher: (local: 'cliente' | 'base') => void;
}

export function EscolhaLocalVistoria({ onEscolher }: EscolhaLocalVistoriaProps) {
  const { data: configBase, isLoading } = useConfiguracaoBase();

  const enderecoCompleto = configBase?.base_logradouro 
    ? `${configBase.base_logradouro}${configBase.base_numero ? `, ${configBase.base_numero}` : ''} - ${configBase.base_bairro || ''} - ${configBase.base_cidade || ''}/${configBase.base_uf || ''}`
    : null;

  const horarioFuncionamento = configBase?.base_horario_inicio && configBase?.base_horario_fim
    ? `${configBase.base_horario_inicio} às ${configBase.base_horario_fim}`
    : null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Onde deseja realizar a vistoria?</h2>
        <p className="text-sm text-muted-foreground">
          Escolha a opção mais conveniente para você
        </p>
      </div>

      <div className="grid gap-4">
        {/* Opção 1: Técnico vai até o cliente */}
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          onClick={() => onEscolher('cliente')}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold flex items-center gap-2">
                  Quero que o técnico venha até mim
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  Um vistoriador irá ao seu endereço para realizar a vistoria do veículo
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  📅 Agendamento disponível em até 48h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opção 2: Cliente vai até a base */}
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          onClick={() => onEscolher('base')}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-orange-500/10 p-3">
                <Building2 className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold flex items-center gap-2">
                  Quero levar meu veículo até a Base
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  Leve seu veículo à nossa sede para realizar a vistoria no local
                </p>
                
                {isLoading ? (
                  <div className="space-y-1 mt-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {enderecoCompleto && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground/80">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{enderecoCompleto}</span>
                      </div>
                    )}
                    {horarioFuncionamento && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Horário: {horarioFuncionamento}</span>
                      </div>
                    )}
                    {!enderecoCompleto && (
                      <p className="text-xs text-muted-foreground/70">
                        📍 Endereço disponível após selecionar esta opção
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Após escolher o local, você poderá selecionar o melhor horário para a vistoria
      </p>
    </div>
  );
}
