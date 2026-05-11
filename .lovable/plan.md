## Adicionar aba "Outros Processos" ao lado de Finalizadas

A infraestrutura já existe (hook `useOutrosProcessos`, componente `OutrosProcessosPanel`, contador `outrosCount` já calculado em `Cotacoes.tsx`). Foi apenas removida da UI no passado. Vou reativá-la **apenas como 3ª aba interna**, sem reintroduzir o `outerTab`.

### Mudanças (somente em `src/pages/vendas/Cotacoes.tsx`)

1. Trocar `TabsList grid-cols-2` por `grid-cols-3` e adicionar:
   ```
   <TabsTrigger value="outros_processos" className="gap-2">
     Outros Processos
     <Badge ...>{outrosCount}</Badge>
   </TabsTrigger>
   ```
2. Adicionar um `<TabsContent value="outros_processos">` renderizando `<OutrosProcessosPanel />` (importar o componente).
3. Esconder os filtros de busca/etapa/data/consultor quando `activeTab === 'outros_processos'` (o painel tem filtros próprios), evitando UI duplicada.
4. Remover o comentário "Aba Outros Processos removida" e o wrapper `<Tabs value="cotacoes">` de uma aba só (linhas 829–831), já que perdeu o sentido.

### Fora de escopo
- Não mexo em `outerTab` (já órfão) — limpo apenas o wrapper morto.
- Não altero hook nem painel; uso como já estão.
- Não toco em backend/migrations.

Quer que eu siga assim?