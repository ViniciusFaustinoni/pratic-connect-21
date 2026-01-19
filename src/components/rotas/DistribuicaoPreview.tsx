import { useMemo } from 'react';
import { User, MapPin, Car, ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

interface InstalacaoPreview {
  id: string;
  bairro: string | null;
  cidade: string | null;
  associados?: { id: string; nome: string } | null;
  veiculos?: { id: string; placa: string; marca: string; modelo: string } | null;
}

interface Instalador {
  id: string;
  nome: string;
}

export interface DistribuicaoItem {
  instaladorId: string;
  instaladorNome: string;
  instalacoes: InstalacaoPreview[];
}

interface DistribuicaoPreviewProps {
  instaladores: Instalador[];
  instalacoes: InstalacaoPreview[];
  distribuicao: DistribuicaoItem[];
  onRedistribuir: () => void;
  onMoverInstalacao?: (instalacaoId: string, novoInstaladorId: string) => void;
}

export function DistribuicaoPreview({
  instaladores,
  instalacoes,
  distribuicao,
  onRedistribuir,
}: DistribuicaoPreviewProps) {
  const totalInstalacoes = instalacoes.length;

  if (!instaladores.length || !instalacoes.length) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Preview da Distribuição
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedistribuir}
            className="h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Redistribuir
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {totalInstalacoes} instalação(ões) distribuída(s) entre {instaladores.length} instalador(es)
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-4">
            {distribuicao.map((item, index) => (
              <div key={item.instaladorId}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.instaladorNome}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.instalacoes.length} instalação(ões)
                      </p>
                    </div>
                  </div>
                  
                  <div className="ml-10 space-y-1">
                    {item.instalacoes.map((inst) => (
                      <div
                        key={inst.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/50 text-sm"
                      >
                        <Car className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">
                          {inst.veiculos?.placa || 'S/P'}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="truncate flex-1 text-xs">
                          {inst.associados?.nome || 'Cliente'}
                        </span>
                        {inst.bairro && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <MapPin className="h-2 w-2 mr-1" />
                            {inst.bairro}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Função utilitária para distribuir instalações entre instaladores (round-robin)
export function distribuirInstalacoes(
  instalacoes: InstalacaoPreview[],
  instaladores: Instalador[]
): DistribuicaoItem[] {
  if (!instaladores.length) return [];

  const distribuicao: DistribuicaoItem[] = instaladores.map((inst) => ({
    instaladorId: inst.id,
    instaladorNome: inst.nome,
    instalacoes: [],
  }));

  // Ordenar instalações por bairro para agrupar geograficamente
  const sortedInstalacoes = [...instalacoes].sort((a, b) => {
    const bairroA = a.bairro || '';
    const bairroB = b.bairro || '';
    return bairroA.localeCompare(bairroB);
  });

  // Distribuir de forma que instalações do mesmo bairro fiquem com o mesmo instalador quando possível
  let currentInstaladorIndex = 0;
  let currentBairro = sortedInstalacoes[0]?.bairro;

  sortedInstalacoes.forEach((inst) => {
    // Se mudou de bairro, pode mudar de instalador
    if (inst.bairro !== currentBairro) {
      currentInstaladorIndex = (currentInstaladorIndex + 1) % instaladores.length;
      currentBairro = inst.bairro;
    }

    distribuicao[currentInstaladorIndex].instalacoes.push(inst);
  });

  // Balancear se houver muita diferença
  const maxDiff = Math.ceil(instalacoes.length / instaladores.length);
  let needsBalance = true;
  let iterations = 0;

  while (needsBalance && iterations < 10) {
    needsBalance = false;
    iterations++;

    for (let i = 0; i < distribuicao.length; i++) {
      for (let j = 0; j < distribuicao.length; j++) {
        if (i === j) continue;
        
        const diff = distribuicao[i].instalacoes.length - distribuicao[j].instalacoes.length;
        if (diff > 1) {
          // Mover uma instalação de i para j
          const toMove = distribuicao[i].instalacoes.pop();
          if (toMove) {
            distribuicao[j].instalacoes.push(toMove);
            needsBalance = true;
          }
        }
      }
    }
  }

  return distribuicao;
}
