import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Star, Crown, Check, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const PLANO_ICONS = {
  'Básico': Shield,
  'Completo': Star,
  'Premium': Crown,
};

const PLANO_COLORS = {
  'Básico': 'from-slate-500 to-slate-600',
  'Completo': 'from-blue-500 to-indigo-600',
  'Premium': 'from-amber-500 to-orange-600',
};

export default function PlanosBeneficios() {
  const [activeTab, setActiveTab] = useState('planos');

  const { data: planos, isLoading: loadingPlanos } = useQuery({
    queryKey: ['planos-beneficios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .order('valor_mensal', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: coberturas, isLoading: loadingCoberturas } = useQuery({
    queryKey: ['coberturas-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coberturas')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    },
  });

  if (loadingPlanos || loadingCoberturas) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planos e Benefícios</h1>
        <p className="text-muted-foreground">
          Consulte os planos disponíveis e suas coberturas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="coberturas">Coberturas</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
        </TabsList>

        <TabsContent value="planos" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {planos?.map((plano) => {
              const Icon = PLANO_ICONS[plano.nome as keyof typeof PLANO_ICONS] || Shield;
              const gradientColor = PLANO_COLORS[plano.nome as keyof typeof PLANO_COLORS] || 'from-slate-500 to-slate-600';

              return (
                <Card key={plano.id} className="overflow-hidden">
                  <div className={cn('h-2 bg-gradient-to-r', gradientColor)} />
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', gradientColor)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle>{plano.nome}</CardTitle>
                          <CardDescription>{plano.descricao}</CardDescription>
                        </div>
                      </div>
                      {plano.ativo ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxa de Adesão</span>
                        <span className="font-semibold">{formatCurrency(plano.valor_adesao || 0)}</span>
                      </div>
                    </div>

                    {plano.coberturas && Array.isArray(plano.coberturas) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Coberturas incluídas:</p>
                        <ul className="space-y-1">
                          {(plano.coberturas as string[]).slice(0, 5).map((cob, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              {cob}
                            </li>
                          ))}
                          {(plano.coberturas as string[]).length > 5 && (
                            <li className="text-sm text-primary font-medium">
                              +{(plano.coberturas as string[]).length - 5} coberturas
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {(!planos || planos.length === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum plano cadastrado ainda.</p>
                <p className="text-sm">Os planos são gerenciados na área da Diretoria.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coberturas" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coberturas?.map((cobertura) => (
              <Card key={cobertura.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{cobertura.nome}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {cobertura.codigo}
                      </Badge>
                    </div>
                    <Badge variant={cobertura.tipo === 'principal' ? 'default' : 'secondary'}>
                      {cobertura.tipo}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {cobertura.descricao && (
                    <p className="text-sm text-muted-foreground mb-3">{cobertura.descricao}</p>
                  )}
                  <div className="space-y-1 text-sm">
                    {cobertura.valor_limite && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Limite</span>
                        <span>{formatCurrency(cobertura.valor_limite)}</span>
                      </div>
                    )}
                    {cobertura.percentual_cobertura && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cobertura</span>
                        <span>{cobertura.percentual_cobertura}%</span>
                      </div>
                    )}
                    {cobertura.carencia_dias && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Carência</span>
                        <span>{cobertura.carencia_dias} dias</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!coberturas || coberturas.length === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma cobertura cadastrada ainda.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comparativo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparativo de Planos</CardTitle>
              <CardDescription>
                Compare as características e coberturas de cada plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              {planos && planos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Característica</th>
                        {planos.map((plano) => (
                          <th key={plano.id} className="text-center py-3 px-4 font-medium">
                            {plano.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3 px-4 text-muted-foreground">Taxa de Adesão</td>
                        {planos.map((plano) => (
                          <td key={plano.id} className="text-center py-3 px-4 font-semibold">
                            {formatCurrency(plano.valor_adesao || 0)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4 text-muted-foreground">Qtd. Coberturas</td>
                        {planos.map((plano) => (
                          <td key={plano.id} className="text-center py-3 px-4">
                            {Array.isArray(plano.coberturas) ? plano.coberturas.length : 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-muted-foreground">Status</td>
                        {planos.map((plano) => (
                          <td key={plano.id} className="text-center py-3 px-4">
                            {plano.ativo ? (
                              <Badge variant="default">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum plano para comparar.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
