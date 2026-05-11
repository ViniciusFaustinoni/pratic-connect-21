## Objetivo
Reduzir o repasse do vendedor de R$50,00 para R$25,00 nos cenários cobrados (`cobra_base` e `cobra_rota`). Cenários `isenta_base`/`isenta_rota` continuam sem desconto (regra atual mantida).

## Mudanças

### 1. Parâmetro global
- Atualizar `parametros_comissao` chave `repasse_volante` de `'50.00'` para `'25.00'`.
- Atualizar `parametros_sistema` chave `taxa_repasse_volante` e `taxa_repasse_volante_externo` de `'50'` para `'25'`.

### 2. Função `calcular_comissao_contrato`
- Manter o guard de isenta (já existente).
- O fallback hardcoded passa de `50` para `25`:
  ```sql
  v_repasse := COALESCE(fn_parametro_comissao('repasse_volante'), 25);
  ```
- Demais regras inalteradas.

### 3. Recálculo do histórico
Para cada `comissoes_deducoes` com `tipo='repasse_volante'` cujo contrato vinculado tenha `cenario_adesao IN ('cobra_base','cobra_rota')` (ou seja, não-isento):
- `UPDATE comissoes_deducoes SET valor = 25, descricao = descricao || ' (ajustado 50→25)' WHERE valor = 50 AND ...`
- `UPDATE comissoes` correspondentes: recalcular `valor_deducoes` e `deducoes_detalhes` (substituir entrada `repasse_volante` de 50 para 25).
- Não mexer em comissões de contratos isenta_* (essas serão tratadas pela regra anterior — fora do escopo desta tarefa).

### 4. Comentários/labels
- Atualizar `COMMENT ON COLUMN contratos.tipo_atendimento` e descrição do parâmetro para refletir R$25.
- Atualizar memória `mem://logic/commissions/repasse-volante-isenta-adesao` mencionando o novo valor R$25 nos cenários cobrados.

## Detalhes técnicos
- Tudo via uma única migration (alteração de função + UPDATEs idempotentes nos parâmetros e histórico).
- A migration usará `WHERE valor = 50` como guard de idempotência para evitar reduzir múltiplas vezes.
- Sem alteração de UI — o valor é lido dinamicamente do parâmetro/dedução.
