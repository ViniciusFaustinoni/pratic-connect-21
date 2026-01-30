import { Ticket, Info, Percent, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CampanhaDesconto } from '@/types/campanha-desconto';

interface SeletorCampanhaDescontoProps {
  campanhas: CampanhaDesconto[] | undefined;
  campanhaId: string | undefined;
  onSelect: (campanha: CampanhaDesconto | null) => void;
  isLoading?: boolean;
}

export function SeletorCampanhaDesconto({
  campanhas,
  campanhaId,
  onSelect,
  isLoading,
}: SeletorCampanhaDescontoProps) {
  if (isLoading) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Não mostrar se não houver campanhas
  if (!campanhas || campanhas.length === 0) {
    return null;
  }

  const campanhaSelecionada = campanhas.find((c) => c.id === campanhaId);

  const handleChange = (value: string) => {
    if (value === 'none') {
      onSelect(null);
    } else {
      const campanha = campanhas.find((c) => c.id === value);
      onSelect(campanha || null);
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="h-5 w-5 text-amber-500" />
          <span className="font-medium">Campanha Promocional</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {campanhas.length} disponíve{campanhas.length === 1 ? 'l' : 'is'}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[250px]">
              <p>
                Selecione uma campanha para aplicar desconto na mensalidade.
                O desconto será válido pelos primeiros meses do contrato.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Select value={campanhaId || 'none'} onValueChange={handleChange}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione uma campanha (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Sem campanha</span>
            </SelectItem>
            {campanhas.map((campanha) => (
              <SelectItem key={campanha.id} value={campanha.id}>
                <div className="flex items-center gap-2">
                  <span>{campanha.nome}</span>
                  <Badge variant="outline" className="ml-1">
                    {campanha.tipo_beneficio === 'percentual' ? (
                      <>-{campanha.valor_beneficio}%</>
                    ) : (
                      <>-R$ {campanha.valor_beneficio}</>
                    )}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({campanha.meses_aplicacao} meses)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Preview da campanha selecionada */}
        {campanhaSelecionada && (
          <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{campanhaSelecionada.nome}</p>
                {campanhaSelecionada.descricao && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {campanhaSelecionada.descricao}
                  </p>
                )}
              </div>
              <Badge className="bg-amber-500 text-amber-950">
                {campanhaSelecionada.tipo_beneficio === 'percentual' ? (
                  <><Percent className="h-3 w-3 mr-1" />{campanhaSelecionada.valor_beneficio}%</>
                ) : (
                  <><DollarSign className="h-3 w-3 mr-1" />R$ {campanhaSelecionada.valor_beneficio}</>
                )}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                📅 Válido por <strong>{campanhaSelecionada.meses_aplicacao} meses</strong>
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span>
                Até {format(parseISO(campanhaSelecionada.data_fim), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
