

# Mover Combustiveis de Marcas & Modelos para Tabelas de Apoio

## O que muda

Combustiveis e uma tabela de apoio (como Regioes, Tipos de Veiculo, etc.), nao faz sentido junto com Marcas e Modelos.

## Alteracoes

| Arquivo | Acao |
|---|---|
| `MarcasModelosCombustiveis.tsx` | Remover `CombustiveisTab` e a aba "Combustiveis" do Tabs. Renomear export se necessario |
| `CadastrosBase.tsx` | Adicionar aba "Combustiveis" importando o `CombustiveisTab` extraido |
| `cadastros/CombustiveisTab.tsx` | **Novo** — extrair `CombustiveisTab` de MarcasModelosCombustiveis como componente standalone exportado |
| `GestaoComercial.tsx` | Atualizar banner/help da secao Marcas & Modelos (remover menção a combustiveis) |
| `TabNavigation.tsx` | Atualizar label se mencionar combustiveis |

### Detalhes

1. **Extrair** a funcao `CombustiveisTab` (linhas 168-247) para `src/components/gestao-comercial/cadastros/CombustiveisTab.tsx` como export nomeado
2. **Remover** de `MarcasModelosCombustiveis.tsx` a aba Combustiveis — o componente fica so com Marcas e Modelos (sem Tabs wrapper, ou manter se preferir consistencia)
3. **Adicionar** em `CadastrosBase.tsx` uma quinta aba "Combustiveis" apontando para o novo componente
4. **Atualizar** `sectionBanners[8]` em `GestaoComercial.tsx` de "Marcas, Modelos e Combustíveis" para "Marcas e Modelos"

