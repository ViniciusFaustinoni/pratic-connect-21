import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVeiculosAceitos, useMotosAceitas } from '@/hooks/useConteudosSistema';
import { useConfigFipeRastreador, useConfigFipeRastreadorMoto } from '@/hooks/useConfigRastreador';
import { useProductLines } from '@/hooks/usePlans';
import { Car, Bike, Loader2 } from 'lucide-react';

export function VeiculosAceitosCarros() {
  const { data: veiculosAceitos = {}, isLoading } = useVeiculosAceitos();
  const { data: productLines } = useProductLines();
  const marcas = Object.entries(veiculosAceitos);

  // Montar texto dinâmico com nomes das linhas de carros
  const linhasCarros = productLines
    ?.filter(pl => pl.tipo_veiculo === 'carro' && pl.is_active)
    .map(pl => pl.name) || [];
  const textoLinhas = linhasCarros.length > 0
    ? `Válido para ${linhasCarros.join(', ')}`
    : 'Válido para todas as linhas de carros';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Veículos Aceitos</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {textoLinhas}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {marcas.map(([marca, modelos]) => (
            <AccordionItem key={marca} value={marca}>
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <span>{marca}</span>
                  <Badge variant="secondary" className="text-xs">
                    {(modelos as string[]).length} modelos
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(modelos as string[]).map((modelo) => (
                    <Badge 
                      key={modelo} 
                      variant="outline" 
                      className="text-xs font-normal"
                    >
                      {modelo}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function VeiculosAceitosMotos() {
  const { data: motosAceitas = {}, isLoading } = useMotosAceitas();
  const { data: fipeCarro = 30000 } = useConfigFipeRastreador();
  const { data: fipeMoto = 9000 } = useConfigFipeRastreadorMoto();
  const marcas = Object.entries(motosAceitas);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Motos Aceitas</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {marcas.map(([marca, info]) => (
          <div 
            key={marca}
            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
          >
            <span className="font-medium">{marca}</span>
            <Badge variant="secondary" className="text-xs font-normal">
              {info as string}
            </Badge>
          </div>
        ))}
        
        <div className="mt-4 space-y-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            ⚠️ Atenção:
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <li>• Honda/Yamaha acima de R$35.000: Apenas Advanced</li>
            <li>• FIPE acima de R$ {fipeMoto.toLocaleString('pt-BR')}: Rastreador obrigatório</li>
            <li>• Acima de R$ {fipeCarro.toLocaleString('pt-BR')}: Requer autorização por email</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
