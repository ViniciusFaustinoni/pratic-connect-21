# Fix: veículos 0KM no SGA — omitir `placa` em vez de enviar string vazia

## Problema confirmado

A doc oficial da Hinova diz, sobre `placa`:
> "Caso o veículo seja ZERO KM **não necessário enviar ou enviar vazio**."

Hoje, em `supabase/functions/_shared/hinova-payloads.ts` (`buildVeiculoPayload`), sempre incluímos a chave `placa` no payload, mesmo quando ela é vazia (placeholder `0KM91CD6` → `placaParaSga()` retorna `""`). A API da Hinova interpreta `""` como uma placa real "vazia" já existente, e responde:

> "Já existe um veículo com a placa cadastrado no sistema"

Resultado: o veículo **0KM91CD6** da Andresa Damasceno Campos (HONDA PCX 160, chassi `9C2KF5210TR007705`) trava ao cadastrar, mesmo após termos corrigido combustível, FIPE e código do vendedor.

## Correção

### 1. `supabase/functions/_shared/hinova-payloads.ts`
Em `buildVeiculoPayload`, mudar de:
```ts
placa: placaParaSga(veiculo.placa),
```
para algo equivalente a:
```ts
const placaSga = placaParaSga(veiculo.placa);
if (placaSga) payload.placa = placaSga;
```
Ou seja: **se placa vazia/placeholder, não incluir o campo no payload** (em vez de mandar string vazia).

Mesma lógica de hardening pode ser feita em `renavam` (também opcional na Hinova) — mas só faço se você quiser.

### 2. Reprocessar a Andresa
Após o deploy:
1. Resetar a fila SGA do veículo `0KM91CD6` (`sga_sync_queue` → `pendente`, zerar tentativas).
2. Disparar `sga-hinova-sync` para esse `veiculo_id` + `associado_id`.
3. Validar o `cadastrar_veiculo` em `sga_sync_logs`:
   - Sem chave `placa` no request.
   - Status `success` com `codigo_veiculo` retornado.
4. Confirmar `veiculos.codigo_hinova` e `sincronizado_hinova=true`.

## Por que isso é seguro

- Casos com placa real continuam idênticos (`placaParaSga` retorna a placa limpa, condição `if (placaSga)` é truthy).
- A busca prévia por chassi (`6.c` em `sga-hinova-sync/index.ts`) já cobre idempotência de 0KM, então não há risco de duplicar veículo.
- Atualização posterior da placa real continua via `sga-atualizar-placa` (já existe e está integrado ao fluxo de "atualizar placa do 0KM").

## Não incluído neste plano
- Reformar busca por placa para 0KM (já é pulada via `isPlacaPlaceholder`).
- Mudar regra de envio de chassi (segue obrigatório e validado).
- Mexer em outras edge functions (a correção é localizada em `hinova-payloads.ts`).
