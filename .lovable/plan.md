
# Corrigir Fotos da Vistoria de Instalacao/Adesao nao carregando

## Problema

A secao "Fotos da Vistoria de Instalacao / Adesao" mostra "Nenhuma foto de vistoria de adesao encontrada", apesar de existirem 33 fotos na tabela `vistoria_fotos` para o veiculo em questao.

A causa: o hook `useFotosVistoriaPorVeiculo` e chamado em `SinistroAnalise.tsx` separadamente usando `sinistro?.veiculo?.id` (do objeto aninhado do join). Este hook faz 3 queries encadeadas (contratos -> vistorias -> vistoria_fotos) e depende de timing correto do carregamento. Alem disso, a secao das fotos de instalacao (`instalacaoFotos` do `instalacao_fotos`) esta oculta porque essa tabela tem 0 fotos - as fotos estao em `vistoria_fotos`.

## Solucao

Mover a busca das fotos de vistoria para dentro do hook `useSinistroAnalise`, usando `sinistro.veiculo_id` (campo direto do sinistro, mais confiavel que o objeto aninhado do join). Isso garante que:
- A query usa a mesma dependencia das outras queries do hook (veiculo_id direto)
- O gerenciamento de cache e invalidacao fica centralizado
- Elimina problemas de timing entre hooks separados

## Alteracoes

### 1. `src/hooks/useSinistroAnalise.ts`

Adicionar nova query `fotosVistoriaAdesao` dentro do hook (apos a query `instalacaoFotos`, por volta da linha 246):

```
// Fotos da vistoria de adesao (via contratos -> vistorias -> vistoria_fotos)
const { data: fotosVistoriaAdesao = [] } = useQuery({
  queryKey: ['sinistro-analise-fotos-vistoria', sinistro?.veiculo_id],
  queryFn: async () => {
    // 1. Buscar contratos do veiculo
    const { data: contratos } = await supabase
      .from('contratos')
      .select('id')
      .eq('veiculo_id', sinistro!.veiculo_id);
    if (!contratos || contratos.length === 0) return [];

    // 2. Buscar vistorias desses contratos
    const { data: vistorias } = await supabase
      .from('vistorias')
      .select('id, status, modalidade')
      .in('contrato_id', contratos.map(c => c.id));
    if (!vistorias || vistorias.length === 0) return [];

    // 3. Buscar fotos das vistorias
    const { data: fotos } = await supabase
      .from('vistoria_fotos')
      .select('id, tipo, arquivo_url, created_at, vistoria_id')
      .in('vistoria_id', vistorias.map(v => v.id))
      .order('created_at', { ascending: true });

    return (fotos || []).map(foto => ({
      ...foto,
      vistoria_status: vistorias.find(v => v.id === foto.vistoria_id)?.status || null,
      vistoria_modalidade: vistorias.find(v => v.id === foto.vistoria_id)?.modalidade || null,
    }));
  },
  enabled: !!sinistro?.veiculo_id,
});
```

Retornar `fotosVistoriaAdesao` no objeto de retorno do hook.

### 2. `src/pages/eventos/SinistroAnalise.tsx`

- Remover a chamada separada `useFotosVistoriaPorVeiculo` (linha 253)
- Usar `fotosVistoriaAdesao` que agora vem de `useSinistroAnalise`
- Adicionar `fotosVistoriaAdesao` na desestruturacao do hook (linha 238-251)

### 3. Unificar as secoes de fotos

As duas secoes (linhas 828-862 para `instalacao_fotos` e linhas 876-913 para `vistoria_fotos`) devem ser consolidadas em uma unica secao "Fotos da Vistoria de Instalacao / Adesao" que:
- Combina fotos de ambas as fontes (`instalacaoFotos` + `fotosVistoriaAdesao`)
- Sempre e exibida (sem condicional `length > 0`)
- Mostra "Nenhuma foto encontrada" apenas quando AMBAS as fontes estao vazias
