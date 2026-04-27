# Corrigir classificação de "Substituição" no contrato/termo de filiação

## Diagnóstico técnico

Existem dois fluxos distintos que envolvem substituição e o sistema usa **dois valores diferentes** para `tipo_entrada` na tabela `contratos`, causando inconsistência:

1. **Cotação/Cotador com `?tipo_entrada=substituicao`** (`OutrasEntradasMenu`, `Cotador.tsx`, `Cotacao.tsx`):
   - Grava `cotacoes.tipo_entrada = 'substituicao'`.
   - Quando o contrato é gerado por `contrato-gerar` (linhas 674–825), o valor `'substituicao'` é repassado **literal** para `contratos.tipo_entrada`.

2. **Fluxo de substituição estruturado** (edge `efetivar-substituicao`):
   - Cria contrato com `tipo_entrada = 'substituicao_placa'`.

O problema:

- O **template do termo** (`supabase/functions/_shared/template-utils.ts`) só reconhece `'substituicao_placa'`. Quando recebe `'substituicao'`, **nenhum checkbox de operação é marcado** e o helper `substituicao.tipo_operacao` cai em `'Nova Adesão'` (linha 268).
- O **gerador do termo de afiliação** (`termo-afiliacao-utils.ts`, linha 470) faz `contrato.tipo_entrada === 'nova' ? 'adesao' : contrato.tipo_entrada || 'adesao'` — ou seja, qualquer valor desconhecido escapa, mas o tipo `TipoOperacao` (linha 96) **não inclui `'substituicao'`**, e os labels/checks downstream tratam só `substituicao_placa`.
- A `ContratoWizard` (Select de operação, linhas 1025/1183–1188) **não tem opção "Substituição"**, só `substituicao_placa`.
- A constante `TIPO_ENTRADA_SHORT_LABELS` em `OrigemCadastroCard.tsx` também só conhece `substituicao_placa`, então um contrato gravado como `'substituicao'` aparece como "Nova Adesão" no detalhe do veículo.

Resumo: o cotador grava `'substituicao'`, mas todo o pipeline de termo/contrato espera `'substituicao_placa'`. O resultado é o reportado: substituições viram "Nova Adesão" no termo de filiação.

Confirmação no banco: hoje todos os 80 contratos estão com `tipo_entrada='adesao'`, então a correção de código não exige migração de dados retroativos (apenas opcional).

## Decisão de padronização

Adotar **`'substituicao_placa'` como valor canônico** em toda a aplicação (ele já é o usado pela edge `efetivar-substituicao`, pelo template e pelos labels). O valor `'substituicao'` vindo da URL/cotador será convertido para `'substituicao_placa'` no momento da gravação.

## Mudanças

### 1. Cotador / Cotação grava o valor canônico
- `src/pages/vendas/Cotador.tsx` (linha 843) e `src/pages/vendas/Cotacao.tsx` (linha 307): trocar `'substituicao'` por `'substituicao_placa'` no payload `tipo_entrada` salvo em `cotacoes`.
- `src/components/vendas/OutrasEntradasMenu.tsx` (linha 264): manter `'substituicao'` apenas se for usado em URL/navegação; quando persistir no DB, normalizar para `'substituicao_placa'`. (Na prática só precisa trocar onde grava em tabela.)
- `src/pages/public/CotacaoContratacao.tsx` (linhas 102–103): aceitar ambos `'substituicao'` e `'substituicao_placa'` por compatibilidade temporária.

### 2. Edge function `contrato-gerar` normaliza ao gravar
- `supabase/functions/contrato-gerar/index.ts` (linhas 674–825): antes de inserir em `contratos.tipo_entrada`, mapear `'substituicao' → 'substituicao_placa'`. Garante que registros legados de `cotacoes` continuem corretos.

### 3. Wizard de contrato exibe a opção corretamente
- `src/components/contratos/ContratoWizard.tsx`:
  - Linhas 1025+ (Select): adicionar item `'substituicao_placa'` rotulado como "Substituição de Veículo/Placa" e remover qualquer valor `'substituicao'` solto.
  - Linhas 153–157: ao receber `cotacao.tipo_entrada === 'substituicao'`, setar `tipoOperacao = 'substituicao_placa'`.

### 4. Tipo `TipoOperacao` permanece restrito ao canônico
- `supabase/functions/_shared/termo-afiliacao-utils.ts` (linha 470): adicionar normalização `contrato.tipo_entrada === 'substituicao' ? 'substituicao_placa' : ...` para blindar contra dados antigos.

### 5. (Opcional) Migração de dados existentes
- Atualizar registros legados em `cotacoes` e `contratos` que tenham `tipo_entrada='substituicao'` para `'substituicao_placa'`. Hoje não há nenhum em `contratos`; pode existir em `cotacoes` antigas — vou checar e migrar se necessário via tool de insert/update.

## Resultado esperado

- Cadastros marcados como SUB no cotador serão persistidos como `tipo_entrada='substituicao_placa'`.
- O **termo de filiação** marcará o checkbox correspondente a "Substituição de Placa" (template já tem suporte nativo) em vez de cair em "Nova Adesão".
- O detalhe do associado e o `OrigemCadastroCard` exibirão o badge "Substituição" corretamente.
- Os outros tipos (adesão, migração, inclusão, troca de titularidade, reativação) continuam funcionando inalterados.

## Arquivos a editar

- `src/pages/vendas/Cotador.tsx`
- `src/pages/vendas/Cotacao.tsx`
- `src/components/vendas/OutrasEntradasMenu.tsx` (apenas onde grava no DB)
- `src/pages/public/CotacaoContratacao.tsx` (aceitar ambos)
- `src/components/contratos/ContratoWizard.tsx`
- `supabase/functions/contrato-gerar/index.ts`
- `supabase/functions/_shared/termo-afiliacao-utils.ts`
