import { Shuffle, Wrench, ClipboardCheck, FileSearch, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ServicoRota, DistribuicaoServico, TipoVistoria } from '@/types/servicos-rota';
import { TIPO_VISTORIA_LABELS } from '@/types/servicos-rota';

interface DistribuicaoServicosPreviewProps {
  distribuicao: DistribuicaoServico[];
  onRedistribuir: () => void;
  isLoading?: boolean;
}

function ServicoIcon({ tipoServico }: { tipoServico: string }) {
  switch (tipoServico) {
    case 'instalacao':
      return <Wrench className="h-4 w-4 text-blue-600" />;
    case 'vistoria':
      return <ClipboardCheck className="h-4 w-4 text-amber-600" />;
    case 'vistoria_cotacao':
      return <FileSearch className="h-4 w-4 text-purple-600" />;
    default:
      return null;
  }
}

function ServicoItem({ servico }: { servico: ServicoRota }) {
  const tipoLabel = servico.tipo_servico === 'instalacao' 
    ? 'Instalação' 
    : servico.tipo_vistoria 
      ? TIPO_VISTORIA_LABELS[servico.tipo_vistoria as TipoVistoria] || servico.tipo_vistoria
      : 'Vistoria';

  const bgColor = servico.tipo_servico === 'instalacao'
    ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
    : servico.tipo_servico === 'vistoria_cotacao'
      ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
      : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';

  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-md border text-sm', bgColor)}>
      <ServicoIcon tipoServico={servico.tipo_servico} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {servico.placa || 'Sem placa'}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            {tipoLabel}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {servico.associado_nome || 'Cliente não identificado'} • {servico.endereco_bairro || 'Sem bairro'}
        </div>
      </div>
    </div>
  );
}

export function DistribuicaoServicosPreview({
  distribuicao,
  onRedistribuir,
  isLoading = false,
}: DistribuicaoServicosPreviewProps) {
  const totalServicos = distribuicao.reduce((acc, d) => acc + d.servicos.length, 0);
  const totalInstalacoes = distribuicao.reduce(
    (acc, d) => acc + d.servicos.filter(s => s.tipo_servico === 'instalacao').length,
    0
  );
  const totalVistorias = distribuicao.reduce(
    (acc, d) => acc + d.servicos.filter(s => s.tipo_servico !== 'instalacao').length,
    0
  );

  if (distribuicao.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Selecione instaladores e bairros para ver a distribuição</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Distribuição de Serviços</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {totalServicos} serviço(s): {totalInstalacoes} instalação(ões), {totalVistorias} vistoria(s)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedistribuir}
            disabled={isLoading || totalServicos === 0}
            className="gap-1"
          >
            <Shuffle className="h-4 w-4" />
            Redistribuir
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {distribuicao.map((item, index) => (
              <div key={item.instaladorId}>
                {index > 0 && <Separator className="my-3" />}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium">{item.instaladorNome}</span>
                        <p className="text-xs text-muted-foreground">
                          {item.servicos.length} serviço(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-blue-600" />
                        {item.servicos.filter(s => s.tipo_servico === 'instalacao').length}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <ClipboardCheck className="h-3 w-3 text-amber-600" />
                        {item.servicos.filter(s => s.tipo_servico !== 'instalacao').length}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-1 ml-10">
                    {item.servicos.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Nenhum serviço atribuído
                      </p>
                    ) : (
                      item.servicos.map((servico) => (
                        <ServicoItem key={servico.id} servico={servico} />
                      ))
                    )}
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
