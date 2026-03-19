

# Exibir "Substituição de Placa" e Placa Anterior na Proposta

## Problema
Quando um contrato é gerado após substituição de placa, o documento sai como "Nova Adesão" — o `tipo_entrada` já é `substituicao_placa` no banco, e o checkbox `{{operacao.substituicao_placa}}` já funciona no template. Porém, **não existem variáveis para os dados do veículo antigo** (placa, modelo, FIPE), então o template não consegue exibi-los.

## O que já funciona
- `{{operacao.substituicao_placa}}` → já marca `(X)` quando `tipo_entrada === 'substituicao_placa'`
- Tabela `substituicoes_veiculo` já armazena `veiculo_antigo_placa`, `veiculo_antigo_modelo`, `veiculo_antigo_fipe`

## O que falta (3 arquivos, ~30 linhas)

### 1. `supabase/functions/_shared/termo-afiliacao-utils.ts`
Adicionar interface `SubstituicaoData` e campo opcional `substituicao?` no `TermoAfiliacaoData`:
```ts
export interface SubstituicaoData {
  placa_anterior: string;
  modelo_anterior: string;
  fipe_anterior: number;
}
```

Na função `mapearDadosParaTemplate`, aceitar um novo parâmetro opcional `substituicao?: { veiculo_antigo_placa, veiculo_antigo_modelo, veiculo_antigo_fipe }` e mapeá-lo.

### 2. `supabase/functions/_shared/template-utils.ts`
No `criarMapeamentoVariaveis`, adicionar variáveis condicionais quando `dados.substituicao` existir:
```
'substituicao.placa_anterior'  → placa do veículo antigo
'substituicao.modelo_anterior' → modelo do veículo antigo
'substituicao.fipe_anterior'   → valor FIPE do veículo antigo
'substituicao.tipo_operacao'   → "Substituição de Placa"
```

### 3. `supabase/functions/contrato-gerar/index.ts`
Após buscar o contrato, se `tipo_entrada === 'substituicao_placa'`, buscar na tabela `substituicoes_veiculo` o registro vinculado ao mesmo `associado_id` + `veiculo_novo_id` (que é o veículo do contrato). Passar os dados para `mapearDadosParaTemplate`.

## Fluxo resultante
```text
contrato-gerar
├── tipo_entrada === 'substituicao_placa'?
│   ├── Sim → busca substituicoes_veiculo → injeta dados antigos
│   └── Não → fluxo normal (sem mudança)
└── template-utils mapeia {{substituicao.*}} → documento exibe corretamente
```

## Nenhuma migration necessária
Todos os dados já existem no banco. Apenas o mapeamento de variáveis e a consulta na edge function precisam ser atualizados.

## Impacto no template
O editor de templates passa a ter disponíveis as variáveis `{{substituicao.placa_anterior}}`, `{{substituicao.modelo_anterior}}`, `{{substituicao.fipe_anterior}}` e `{{substituicao.tipo_operacao}}` para uso nos documentos. Se não forem usadas, são limpas automaticamente pelo `limparVariaveisNaoSubstituidas`.

