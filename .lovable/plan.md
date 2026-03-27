

# Detalhar Itens do Plano na Seção "Plano Contratado" do Termo de Filiação

## Problema

A seção "3. PLANO CONTRATADO E COBERTURAS" atualmente exibe apenas uma lista simples com nomes curtos (ex: `[X] Roubo`, `[X] Furto`). O correto é exibir todos os itens detalhados do plano — coberturas E benefícios — com suas descrições completas (ex: "Proteção a Terceiros R$: 100.000,00", "Reboque Pane Elétrica ou Mecânica 1000KM Totais").

## Situação atual

Os dados detalhados (`coberturas_detalhadas` e `beneficios_detalhados`) já existem na estrutura de dados e já são carregados pelas edge functions `autentique-create`. Porém, a renderização na seção 3 ignora esses dados e usa apenas o array simples `coberturas[]`.

## Correção

### 1. `supabase/functions/_shared/termo-afiliacao-template.ts` — `generateSecao3`

Atualizar para:
- Quando `coberturas_detalhadas` estiver disponível, renderizar uma tabela com Nome + Descrição/Valor para cada cobertura
- Quando `beneficios_detalhados` estiver disponível, renderizar uma segunda tabela para benefícios
- Manter fallback para o array simples `coberturas[]` quando os dados detalhados não existirem

### 2. `src/components/cadastro/TermoFiliacaoTemplate.tsx` — Seção 3 (React)

Atualizar para:
- Aceitar `coberturas_detalhadas` e `beneficios_detalhados` opcionais nas props/tipos
- Renderizar tabela detalhada com nome + descrição quando disponível
- Separar visualmente "Coberturas" de "Benefícios"
- Manter fallback para a lista simples

### 3. `src/types/termo-filiacao.ts` — `PlanoData`

Adicionar campos opcionais:
- `coberturas_detalhadas?: { nome: string; descricao?: string; valor_personalizado?: string }[]`
- `beneficios_detalhados?: { nome: string; descricao?: string; valor_personalizado?: string }[]`

## Formato visual esperado

Cada item renderizado como:
```text
[X] Proteção contra Roubo e Furto
[X] Proteção contra Incêndio
[X] Proteção a Terceiros — R$: 100.000,00
[X] Reboque para Colisão — Ilimitado somente em caso de acionamento para reparo
[X] Reboque Pane Elétrica ou Mecânica — 1000KM Totais
```

Nome em negrito, descrição/valor ao lado quando existir.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/types/termo-filiacao.ts` | Adicionar tipos detalhados em `PlanoData` |
| `src/components/cadastro/TermoFiliacaoTemplate.tsx` | Renderizar itens detalhados na seção 3 |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Renderizar itens detalhados em `generateSecao3` |

