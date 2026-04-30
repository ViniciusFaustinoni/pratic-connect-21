
# Limpeza da tabela `hinova_mapeamentos` — combustíveis

## Estado atual

| codigo_local | codigo_hinova | descrição | ativo |
|---|---|---|---|
| flex | 1 | FLEX | ✅ |
| gasolina | 2 | GASOLINA | ✅ |
| alcool | 3 | ETANOL | ✅ |
| etanol | 3 | ETANOL | ✅ |
| diesel | 4 | DIESEL | ✅ |
| biogas | 5 | BIO-GAS | ✅ |
| tetrafuel | 6 | TETRA-FUEL | ✅ |
| **gnv** | **5** | GNV | ❌ inativo |
| **eletrico** | **6** | ELETRICO | ❌ inativo |
| **hibrido** | **7** | HIBRIDO | ❌ inativo |

Os 6 combustíveis oficiais do SGA já estão corretos. Mas as 3 últimas linhas (`gnv`, `eletrico`, `hibrido`) **não existem no SGA** e estão **reaproveitando códigos válidos** (5 e 6) — risco real: se alguém reativar `gnv` na UI, o sistema passa a enviar GNV como código 5 (Bio-gás) no Hinova, causando cadastro errado.

## Mudança

Uma única operação de DELETE remove as 3 entradas inexistentes:

```sql
DELETE FROM public.hinova_mapeamentos
 WHERE tipo = 'combustivel'
   AND codigo_local IN ('gnv', 'eletrico', 'hibrido');
```

## Resultado esperado

Tabela final com exatamente 7 linhas (6 códigos SGA — etanol aparece duas vezes como `alcool` e `etanol` apontando para o mesmo código 3, o que é intencional para tolerar variações da FIPE):

| codigo_local | codigo_hinova |
|---|---|
| flex | 1 |
| gasolina | 2 |
| alcool / etanol | 3 |
| diesel | 4 |
| biogas | 5 |
| tetrafuel | 6 |

## Impacto em outros lugares

- **`veiculos.codigo_sga_combustivel`** — não afetado (já populado por trigger com base no texto, não na tabela de mapeamento).
- **`useChecklistSGA`** — continua funcionando: o select filtra por `ativo=true` e nenhuma linha removida estava ativa.
- **Edge `sga-hinova-sync`** — usa `codigo_sga_combustivel` persistido no veículo como fonte primária; mapeamento é fallback.
- **Tela de gestão `CombustiveisTab`** (se existir) — uma linha a menos para listar; nenhuma quebra.

## Observação

Veículos elétricos / híbridos / GNV continuam podendo ser cadastrados no sistema, mas **não podem ser sincronizados com o SGA Hinova** — o checklist SGA já bloqueia o envio quando `codigo_sga_combustivel` é nulo (regra implementada anteriormente). Esse é o comportamento correto, pois o SGA realmente não suporta esses tipos.
