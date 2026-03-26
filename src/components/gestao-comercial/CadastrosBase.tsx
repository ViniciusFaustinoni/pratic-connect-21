import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoriasVeiculoTab } from './cadastros/CategoriasVeiculoTab';
import { CategoriasEspeciaisTab } from './cadastros/CategoriasEspeciaisTab';
import { RegioesTab } from './cadastros/RegioesTab';
import { TiposUsoTab } from './cadastros/TiposUsoTab';
import { TiposPlacaTab } from './cadastros/TiposPlacaTab';

export function CadastrosBase() {
  return (
    <Tabs defaultValue="categorias" className="space-y-4">
      <TabsList>
        <TabsTrigger value="categorias">Tipos de Veículo</TabsTrigger>
        <TabsTrigger value="especiais">Categorias Especiais</TabsTrigger>
        <TabsTrigger value="regioes">Regiões</TabsTrigger>
        <TabsTrigger value="tipos_uso">Modalidades de Uso</TabsTrigger>
        <TabsTrigger value="tipos_placa">Tipos de Placa</TabsTrigger>
      </TabsList>

      <TabsContent value="categorias">
        <CategoriasVeiculoTab />
      </TabsContent>

      <TabsContent value="especiais">
        <CategoriasEspeciaisTab />
      </TabsContent>

      <TabsContent value="regioes">
        <RegioesTab />
      </TabsContent>

      <TabsContent value="tipos_uso">
        <TiposUsoTab />
      </TabsContent>

      <TabsContent value="tipos_placa">
        <TiposPlacaTab />
      </TabsContent>
    </Tabs>
  );
}
