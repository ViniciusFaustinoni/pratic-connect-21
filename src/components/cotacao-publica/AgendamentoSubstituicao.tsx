import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, MapPin, Truck, Wrench, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AgendamentoSubstituicaoProps {
  veiculoAntigoPlaca: string;
  veiculoAntigoModelo: string;
  veiculoNovoDescricao: string;
  onConfirm: (mesmoLocal: boolean) => void;
}

export function AgendamentoSubstituicao({
  veiculoAntigoPlaca,
  veiculoAntigoModelo,
  veiculoNovoDescricao,
  onConfirm,
}: AgendamentoSubstituicaoProps) {
  const [opcao, setOpcao] = useState<'sim' | 'nao' | null>(null);

  return (
    <Card className="border-primary/20 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center pb-4">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
          <ArrowLeftRight className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-xl">Substituição de Veículo</CardTitle>
        <CardDescription>
          Precisamos saber sobre a localização dos veículos para agendar os serviços
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info dos veículos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">Veículo atual (retirada)</p>
            <p className="text-sm font-medium font-mono">{veiculoAntigoPlaca}</p>
            <p className="text-xs text-muted-foreground">{veiculoAntigoModelo}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Veículo novo (instalação)</p>
            <p className="text-sm font-medium">{veiculoNovoDescricao}</p>
          </div>
        </div>

        {/* Pergunta */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-center">
            Os dois veículos estarão no mesmo local no dia do serviço?
          </p>

          <RadioGroup
            value={opcao || ''}
            onValueChange={(v) => setOpcao(v as 'sim' | 'nao')}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <Label
              htmlFor="mesmo-local-sim"
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                opcao === 'sim'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="sim" id="mesmo-local-sim" className="sr-only" />
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Sim, mesmo local</span>
              <span className="text-xs text-muted-foreground text-center">
                Um único agendamento para retirada e instalação
              </span>
            </Label>

            <Label
              htmlFor="mesmo-local-nao"
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                opcao === 'nao'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="nao" id="mesmo-local-nao" className="sr-only" />
              <Truck className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Não, locais diferentes</span>
              <span className="text-xs text-muted-foreground text-center">
                Dois agendamentos separados
              </span>
            </Label>
          </RadioGroup>
        </div>

        {opcao === 'nao' && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs">
              Serão criados dois agendamentos: um para <strong>instalação</strong> do rastreador no veículo novo
              e outro para <strong>retirada</strong> do rastreador do veículo atual.
            </AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          disabled={!opcao}
          onClick={() => opcao && onConfirm(opcao === 'sim')}
        >
          Continuar para agendamento
        </Button>
      </CardContent>
    </Card>
  );
}
