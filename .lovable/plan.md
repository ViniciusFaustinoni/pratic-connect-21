
# Validação E2E — sga-hinova-sync

## Objetivo
Confirmar, com dados reais, que o fluxo refatorado executa na ordem canônica do Hinova:
1. Buscar associado por CPF → reusa ou cadastra
2. Buscar veículo por placa/chassi → reusa, falha se de outro associado, ou cadastra
3. Upload de fotos em lotes de 50

## Etapas

### 1. Selecionar candidato de teste
Rodar SELECT em `associados` + `contratos` + `veiculos` filtrando:
- `status = 'ativo'`
- `codigo_associado_hinova IS NULL` (nunca sincronizado) **ou** um associado já sincronizado para validar o caminho "reuso"
- veículo com `placa`, `chassi`, `codigo_fipe`, `ano_fabricacao` preenchidos
- documentos/fotos disponíveis em `documentos_associado` ou bucket equivalente

Apresentar 1–2 candidatos e pedir confirmação antes de disparar.

### 2. Disparar sync
`supabase--curl_edge_functions` POST `/sga-hinova-sync` com `{ associado_id, contrato_id, veiculo_id }` (payload exato a confirmar lendo o handler).

### 3. Coletar evidências
- `supabase--edge_function_logs sga-hinova-sync` — extrair as 3 fases (associado, veículo, fotos) e os `codigo_*` retornados pelo Hinova
- SELECT pós-sync em `associados.codigo_associado_hinova`, `veiculos.codigo_veiculo_hinova`, `sga_sync_log` (ou tabela equivalente) para confirmar persistência
- Conferir contagem de fotos enviadas vs documentos elegíveis

### 4. Cenários a cobrir (idealmente 3 execuções)
- **A — Cadastro novo**: associado sem `codigo_associado_hinova`. Deve passar pelas 3 fases criando tudo.
- **B — Reuso de associado**: re-disparar no mesmo registro. Deve achar por CPF, achar veículo por placa, **não** recriar nada, e (idempotência) não reenviar fotos duplicadas.
- **C — Veículo de outro dono** (se houver caso real): confirmar que falha permanente é registrada sem corromper estado.

### 5. Critérios de aceite
- Fase 1 retorna `codigo_associado` e grava em `associados`
- Fase 2 retorna `codigo_veiculo` e grava em `veiculos`
- Fase 3 envia fotos em lotes ≤ 50, com `codigo_tipo` correto por documento
- Reexecução é idempotente (sem duplicatas no Hinova)
- Logs sem stack trace de erro nas 3 fases

## Detalhes técnicos
- Ler `supabase/functions/sga-hinova-sync/index.ts` para confirmar nome dos parâmetros de entrada
- Ler `_shared/hinova-payloads.ts` para mapear `codigo_tipo` de fotos vs `documentos.tipo`
- Se faltar algum mapeamento de tipo de foto (CRLV, CNH, chassi, frente, lateral, traseira, motor), reportar antes de disparar — não inventar valores

## Riscos
- O teste **cria registros reais no Hinova**. Vou pedir confirmação explícita do CPF/placa antes de disparar a fase de cadastro.
- Se o candidato não tiver `codigo_fipe` ou `chassi` válido, o cadastro do veículo falha — nesse caso reporto e peço outro candidato.

## O que muda no código
Nada por padrão. Só edito se o teste expor bug real — nesse caso, paro e reporto antes de mexer.
