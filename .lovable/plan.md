
# Cor do veículo com código SGA — mesma lógica aplicada ao combustível

## Códigos reais do SGA (PDF Hinova)

| Código | Cor | | Código | Cor |
|---|---|---|---|---|
| 1 | Preto | | 10 | Não especificado |
| 2 | Branca | | 11 | Dourado |
| 3 | Azul | | 12 | Laranja |
| 4 | Vermelho | | 13 | Marrom |
| 5 | Verde | | 14 | Fantasia |
| 6 | Cinza | | 15 | Roxo |
| 7 | Bege | | 16 | Rosa |
| 8 | Amarelo | | 19 | Teste |
| 9 | Prata | | | |

## Problema atual

A tabela `hinova_mapeamentos` (tipo `cor`) está com **códigos completamente errados** — exemplo: hoje tem Branco=2, Prata=3, Azul=6, Vermelho=5, e contém "bronze" (que não existe no SGA). Vermelho real é 4, Azul é 3, etc. Resultado: veículos podem ser sincronizados com cor errada no Hinova.

Além disso, hoje o código é resolvido em runtime no `sga-hinova-sync` consultando texto livre, sem persistir no veículo.

## Mudanças (idênticas ao fluxo de combustível já implementado)

### 1. Migration

- **Atualizar `hinova_mapeamentos` tipo `cor`** com os 16 códigos reais do SGA.
- Inserir entradas faltantes: `nao_especificado→10`, `fantasia→14`.
- Marcar `bronze` como inativo (não existe no SGA — fallback no normalizador para Dourado).
- **Adicionar coluna `codigo_sga_cor INT`** em `veiculos`.
- **Criar função `resolver_codigo_sga_cor(text) RETURNS int`** com normalização tolerante:
  - Aceita variações: `branca/branco`, `preta/preto`, `vermelha/vermelho`, `amarela/amarelo`, `roxa/roxo`.
  - Aceita modificadores: `azul perolizado`, `prata pyrit`, `vermelha perolizada`, `cinza grafite`.
  - Sinônimos: `silver→prata`, `gold→dourado`, `castanho→marrom`, `lilás/violeta→roxo`, `pink→rosa`, `multicolor/personalizada→fantasia`.
  - Cor não reconhecida → retorna **10 (Não especificado)** em vez de NULL (cor é menos crítica que combustível).
- **Trigger BEFORE INSERT/UPDATE OF cor** em `veiculos` mantém `codigo_sga_cor` sempre sincronizado.
- **Backfill seguro** com bloco DO (pula linhas que tenham chassi legado inválido, igual ao backfill de combustível).

### 2. Edge `sga-hinova-sync`

Substituir a linha:
```ts
codigo_cor: getMap('cor', veiculo.cor)
```
por:
```ts
codigo_cor: (veiculo.codigo_sga_cor != null ? Number(veiculo.codigo_sga_cor) : null) 
            ?? getMap('cor', veiculo.cor) 
            ?? 10  // fallback final: Não especificado
```

A cor **não bloqueia** o envio (diferente do combustível) — fallback final 10 (Não especificado) garante que a sincronização nunca falhe por isso, e logamos em `sga_sync_logs` quando o fallback é usado.

### 3. Checklist SGA (`useChecklistSGA.ts`)

Atualizar item de Cor para usar `codigo_sga_cor` persistido:
- Status **ok** se `codigo_sga_cor` ∈ {1..16} mapeada de texto reconhecido.
- Status **risco** (não bloqueia) se cor cair no fallback 10 (Não especificado) ou estiver vazia.
- Mostrar `cor → SGA N` no valor.

### 4. Não há mudança no `useFipeLookup` nem em telas de cadastro

A trigger no banco garante que toda inserção/edição de `veiculos.cor` (via FIPE, manual, OCR, importação) preencha automaticamente `codigo_sga_cor`. Nenhuma alteração necessária no front-end de cadastro.

## Arquivos afetados

- **Migration nova** — atualiza `hinova_mapeamentos`, adiciona `veiculos.codigo_sga_cor`, função, trigger, backfill.
- `supabase/functions/sga-hinova-sync/index.ts` — usa `veiculo.codigo_sga_cor` com fallback final 10.
- `src/hooks/useChecklistSGA.ts` — exibe código SGA resolvido para cor.

## Validação pós-deploy

1. `SELECT codigo_sga_cor, count(*) FROM veiculos WHERE cor IS NOT NULL GROUP BY 1` — esperado: maioria em 1/2/6/9 (Preto/Branca/Cinza/Prata).
2. Reenviar um veículo de teste — confirmar que `codigo_cor` no payload Hinova bate com a cor real.
3. Cadastrar veículo com cor exótica ("azul perolizado") — verificar que `codigo_sga_cor=3` (Azul) é gravado pela trigger.

## Observações

- Diferente do combustível, **cor desconhecida não bloqueia** o envio — usa fallback "Não especificado" (10), pois SGA aceita esse valor e cor é dado secundário.
- `bronze` (que não existe no SGA) cai em "Dourado" (11), aproximação razoável.
- Mantém a tabela `hinova_mapeamentos` ativa para compatibilidade com a edge function (fallback `getMap`).
