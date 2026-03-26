import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoriasVeiculoTab } from './cadastros/CategoriasVeiculoTab';
import { CategoriasEspeciaisTab } from './cadastros/CategoriasEspeciaisTab';
import { RegioesTab } from './cadastros/RegioesTab';

export function CadastrosBase() {
  return (
    <Tabs defaultValue="categorias" className="space-y-4">
      <TabsList>
        <TabsTrigger value="categorias">Categorias de Veículo</TabsTrigger>
        <TabsTrigger value="especiais">Categorias Especiais</TabsTrigger>
        <TabsTrigger value="regioes">Regiões</TabsTrigger>
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
    </Tabs>
  );
}
