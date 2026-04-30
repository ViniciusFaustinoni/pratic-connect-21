
# Combustível com código SGA — fonte única e envio correto

## Problema

Hoje o sistema:
- Salva combustível como texto livre em `veiculos.combustivel` (vindo da FIPE).
- Mapeia para código Hinova **em tempo de envio** consultando `hinova_mapeamentos`.
- A tabela `hinova_mapeamentos` está com **códigos errados** (Gasolina=1, mas no SGA real Gasolina=2) e contém combustíveis que **não existem no SGA** (GNV, Elétrico, Híbrido).
- Resultado: veículos podem ser enviados ao Hinova com `codigo_combustivel` inválido ou nulo.

Códigos reais do SGA (PDF Hinova):

| Código | Descrição |
|---|---|
| 1 | Flex |
| 2 | Gasolina |
| 3 | Etanol |
| 4 | Diesel |
| 5 | Bio-gás |
| 6 | Tetra-fuel |

## Estratégia

1. **Corrigir o catálogo `hinova_mapeamentos`** com os códigos reais do SGA.
2. **Persistir o código SGA no veículo** assim que o combustível é detectado (FIPE/manual), em vez de só resolver no envio.
3. **Sync Hinova** passa a usar o código já gravado, com fallback à normalização atual.
4. **UI de Combustíveis** (Gestão Comercial → Cadastros Base) ganha o campo `codigo_sga` para edição futura.

## Mudanças

### 1. Banco (migration)

- **Atualizar `hinova_mapeamentos` tipo `combustivel`** para refletir o SGA:
  - `flex → 1`, `gasolina → 2`, `etanol → 3`, `alcool → 3`, `diesel → 4`, `biogas → 5`, `tetrafuel → 6`.
  - Marcar como `ativo=false` os obsoletos: `gnv`, `eletrico`, `hibrido` (mantém histórico, mas não retorna no lookup).
- **Adicionar coluna `codigo_sga INT` em `veiculos`** (nullable). Recebe o código no momento da detecção/edição.
- **Backfill**: popular `veiculos.codigo_sga` para todos os veículos existentes a partir do `combustivel` atual usando a tabela corrigida (CASE quando texto contém flex/gasolina/etc.).
- **Trigger `trg_veiculos_set_codigo_sga_combustivel`**: BEFORE INSERT/UPDATE em `veiculos`, quando `combustivel` mudar, recalcula `codigo_sga` consultando `hinova_mapeamentos`.

### 2. Util compartilhado de normalização

Criar `src/lib/combustivelSGA.ts` com:
- `normalizarCombustivel(raw: string): { slug, codigo_sga }` — função pura usada em UI/edge.
- Mesma lógica espelhada na trigger do banco (single source of truth da regra).

### 3. FIPE → veículo

- Em `useFipeLookup`/fluxos que gravam veículo (cotação, substituição, edição manual), além de salvar `combustivel`, calcular e salvar `codigo_sga` via util.
- Como a trigger já garante consistência, basta enviar o texto; o `codigo_sga` cai automaticamente. A util do front é só para exibir o código previsto na UI.

### 4. Edge `sga-hinova-sync`

- Trocar a resolução atual:
  ```
  codigo_combustivel: getMap('combustivel', normalCombustivel)
  ```
  por:
  ```
  codigo_combustivel: veiculo.codigo_sga ?? getMap('combustivel', normalCombustivel)
  ```
- Adicionar **pré-flight**: se `codigo_combustivel` for null, abortar com erro claro `"combustivel sem mapeamento SGA"` (igual ao padrão FIPE/CEP já implementado).

### 5. Checklist SGA (`useChecklistSGA`)

- Adicionar item crítico **"Combustível com código SGA"** na seção Veículo. Bloqueia envio se ausente.

### 6. UI de Combustíveis (Gestão Comercial)

- `CombustiveisTab.tsx`: adicionar coluna/input `Código SGA` em cada item.
- Ao salvar, persistir em `hinova_mapeamentos` (não só no JSON de configuração).
- Mostrar badge para combustíveis sem código SGA mapeado.

### 7. Logs

- No `sga_sync_logs`, na ação `montar_payload`, logar `combustivel_texto`, `codigo_sga_resolvido`, `origem` (`veiculo.codigo_sga` | `mapeamento_runtime` | `null`).

## Arquivos afetados

- **Migration nova**: corrige `hinova_mapeamentos`, adiciona `veiculos.codigo_sga`, trigger e backfill.
- `supabase/functions/sga-hinova-sync/index.ts` — usa `veiculo.codigo_sga`, pré-flight, log enriquecido.
- `src/lib/combustivelSGA.ts` — **novo** util.
- `src/hooks/useChecklistSGA.ts` — novo item crítico.
- `src/components/gestao-comercial/cadastros/CombustiveisTab.tsx` — campo código SGA + persistência em `hinova_mapeamentos`.
- (Opcional) hooks de cadastro de veículo que mostram preview do combustível detectado.

## Validação pós-deploy

1. Backfill: `SELECT combustivel, codigo_sga, count(*) FROM veiculos GROUP BY 1,2` — não pode haver `combustivel` preenchido com `codigo_sga` nulo (exceto casos exóticos).
2. Reenviar Lucas (KPI8571) e Alair (RTY3J80) — verificar que `codigo_combustivel` vai correto no payload.
3. Cadastrar veículo novo via FIPE — confirmar `codigo_sga` gravado automaticamente pela trigger.

## Observações

- Não removo a tabela `hinova_mapeamentos` — ela continua sendo a fonte para outros tipos (cor, tipo_veiculo, tipo_foto).
- GNV/Elétrico/Híbrido ficam `ativo=false`: se um veículo tiver esses combustíveis, o checklist bloqueia e o operador escolhe manualmente o código SGA mais próximo (provavelmente Flex/Gasolina) ou pede cadastro no Hinova.
