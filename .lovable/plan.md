

# Remover seção "Elegibilidade" do menu da Gestão Comercial

## Contexto

A seção "Elegibilidade" existe como item separado no sidebar, mas essa configuração já está integrada diretamente no formulário de criação/edição de planos (PlanoFormSheet) com regras de FIPE, ano, regiões, tipo de veículo, etc. Portanto é redundante e deve ser removida.

## Alterações

| Arquivo | Ação |
|---|---|
| `TabNavigation.tsx` | Remover item "Elegibilidade" do grupo "Operação" |
| `GestaoComercial.tsx` | Remover import de `ElegibilidadeVeiculos`, remover entrada `4` do `sectionBanners`, remover renderização condicional `activeTab === 4`, reindexar tabs 5→4, 6→5, 7→6, 8→7 |

### Reindexação

O grupo "Operação" passa de 3 para 2 itens. Os índices globais mudam:

```text
0 - Cob. & Benef.     (sem mudança)
1 - Linhas & Planos    (sem mudança)
2 - Simulador           (sem mudança)
3 - Config. Rateio      (sem mudança)
4 - Regras de Venda     (era 5)
5 - Instalação e Rotas  (era 6)
6 - Tabelas de Apoio    (era 7)
7 - Marcas e Modelos    (era 8)
```

O componente `ElegibilidadeVeiculos` pode ser mantido no codebase (não causa impacto), mas o import e referência serão removidos de `GestaoComercial.tsx`.

