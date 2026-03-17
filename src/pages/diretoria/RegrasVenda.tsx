import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award } from 'lucide-react';

export default function RegrasVenda() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Regras de Venda</h1>
        <p className="text-muted-foreground">
          Configure as regras comerciais que orientam o processo de vendas e a avaliação dos consultores.
        </p>
      </div>

      <Tabs defaultValue="pontuacao" className="w-full">
        <TabsList>
          <TabsTrigger value="pontuacao" className="gap-2">
            <Award className="h-4 w-4" />
            Pontuação do Consultor
          </TabsTrigger>
          {/* Futuras abas: basta adicionar novos TabsTrigger + TabsContent */}
        </TabsList>

        <TabsContent value="pontuacao">
          <Card>
            <CardHeader>
              <CardTitle>Pontuação do Consultor</CardTitle>
              <CardDescription>
                As regras de pontuação do consultor serão configuradas aqui. 
                Defina critérios, pesos e metas que compõem o score de cada consultor comercial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Em breve você poderá configurar os critérios de pontuação, faixas de classificação e bonificações.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
