## Causa-raiz

`supabase/functions/sga-hinova-sync/index.ts` (linha 374-388) trata RENAVAM como obrigatório para qualquer veículo. Para 0KM o documento ainda não foi emitido pelo Detran e o campo fica vazio, marcando o registro como `falha_permanente` na fila SGA.

Casos pendentes em `sga_sync_queue` (todos 0KM, sem renavam):

| Placa     | Chassi              | Tentativas | Erro |
|-----------|---------------------|------------|------|
| 0KMD915D  | 9C2KC2210TR077722   | 11         | RENAVAM obrigatório |
| 0KM3D5B4  | 9C2KF5200TR010154   | 10         | RENAVAM obrigatório |
| 0KM522E8  | 9C2KC2200TR469045   | 10         | RENAVAM obrigatório |
| 0KM91CD6  | 9C2KF5210TR007705   | 10         | RENAVAM=`0000000` (placeholder) — outro erro Hinova "Página não encontrada" |

Outros 2 casos da fila são por placa duplicada (associado já existe no Hinova) — fora do escopo deste fix.

## O que faremos

### 1. `sga-hinova-sync/index.ts` — RENAVAM opcional para 0KM

Substituir o bloco de validação:

```ts
const isZeroKm = String(veiculo.placa || '').toUpperCase().startsWith('0KM')
  || veiculo.aguardando_placa_definitiva === true;

const obrigatorios = [
  { k: 'placa',  v: veiculo.placa,  label: 'PLACA' },
  { k: 'chassi', v: veiculo.chassi, label: 'CHASSI' },
];
if (!isZeroKm) {
  obrigatorios.push({ k: 'renavam', v: veiculo.renavam, label: 'RENAVAM' });
}
```

Critério "veículo 0KM" = placa começa com `0KM` (padrão usado pelo sistema, confirmado via dados) **OU** flag `veiculos.aguardando_placa_definitiva = true`.

### 2. Limpar placeholder "0000000"

Edge function passa a tratar `'0000000'` (e variantes só de zero) como vazio antes de mandar para a Hinova, evitando rejeição.

### 3. Reprocessar a fila

Migration que:
- Atualiza os 3 veículos 0KM presos com `status='pendente'`, `tentativas=0`, `erro_ultimo=null` em `sga_sync_queue`.
- Limpa `veiculos.renavam='0000000'` para `NULL` no caso `0KM91CD6`.
- Reenfileira via `enqueue_integration` (`sga` / `hinova_sync`) os 4 veículos para nova tentativa.

### 4. Validação

- Conferir `sga_sync_logs` após reprocesso — espera-se que o passo `validar_veiculo` passe e a sync siga até `cadastrar_veiculo` no Hinova.
- Os 2 casos de "placa já cadastrada" continuam exigindo decisão manual (não tocar agora).

## Riscos

- Nenhum: a Hinova aceita cadastro sem RENAVAM para 0KM (já confirmado por casos antigos resolvidos manualmente). Se a API Hinova rejeitar mesmo assim, o erro retornará na queue e ficaremos sabendo — sem perda de dados.

## Memória

Adicionar entrada `mem://logic/operations/sga-renavam-opcional-zero-km` e core: "RENAVAM não é obrigatório para 0KM (placa `0KM*` ou `aguardando_placa_definitiva=true`) na sincronização SGA Hinova."

Aprovar para implementar?