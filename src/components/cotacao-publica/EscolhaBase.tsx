import { MapPin, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBasesPratic } from '@/hooks/useBasesPratic';
import { useOficinas } from '@/hooks/useOficinas';

interface EscolhaBaseProps {
  onEscolher: (oficinaId: string) => void;
  onVoltar: () => void;
}

export function EscolhaBase({ onEscolher, onVoltar }: EscolhaBaseProps) {
  const { data: bases, isLoading } = useBasesPratic();

  // Also fetch full oficina data for address
  const { data: oficinas } = useOficinas();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h3 className="font-semibold text-lg">Escolha a base</h3>
        <p className="text-sm text-muted-foreground">
          Selecione em qual unidade deseja levar o veículo para vistoria
        </p>
      </div>

      <div className="space-y-3">
        {(bases || []).map((base) => {
          const oficina = oficinas?.find(o => o.id === base.id);
          const endereco = oficina?.logradouro
            ? `${oficina.logradouro}${oficina.numero ? `, ${oficina.numero}` : ''} - ${oficina.bairro || ''}, ${oficina.cidade || ''}/${oficina.estado || ''}`
            : '';

          return (
            <Card
              key={base.id}
              className="cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all"
              onClick={() => onEscolher(base.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">
                      {base.nome_fantasia || base.razao_social}
                    </h4>
                    {endereco && (
                      <div className="flex items-start gap-1.5 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{endereco}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" onClick={onVoltar} className="w-full">
        Voltar
      </Button>
    </div>
  );
}
