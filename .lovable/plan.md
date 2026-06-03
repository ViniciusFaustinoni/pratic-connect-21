
# LQD7A71 — fotos do veículo não foram para o SGA

## Causa raiz (confirmada nos dados)

Cruzando `sga_fotos_enviadas` × `vistoria_fotos` × `vistorias`:

| Origem | Itens locais | Enviado ao SGA |
|---|---|---|
| `contratos_documentos` (CNH, CRLV, comprovante, selfie, contrato) | 8 | **8 ✅** |
| `vistoria_fotos` (motor, chassi, exterior, interior do veículo) | **34** | **0 ❌** |

Há **uma única** vistoria do veículo (`54df07b9…`, modalidade `autovistoria`) com as 34 fotos. Ela foi marcada `status='cancelada'` quando o técnico presencial assumiu e fechou a `instalacoes` (11:57).

O coletor de fotos do `sga-hinova-sync` (`index.ts`, linhas 1732-1760) filtra:

```ts
.from('vistorias').select('id').eq('veiculo_id', _vid)
.in('status', ['concluida', 'aprovada'])
```

→ a única vistoria com fotos é `'cancelada'` → **zero fotos coletadas** → SGA recebeu só docs do contrato.

Não é problema do SGA, nem do operador. É um buraco no contrato vistoria↔instalação: quando a autovistoria do cliente é "substituída" pela vistoria presencial do técnico, as fotos físicas legítimas ficam órfãs porque a vistoria onde estão materializadas é descartada como `cancelada`.

## Plano

### 1. Saneamento pontual (insert tool — dados)
- `UPDATE vistorias SET status='concluida', concluida_em=COALESCE(concluida_em, now()) WHERE id='54df07b9-a15d-4650-b063-5bf5ae69b8c7'` — as 34 fotos são reais e a operação foi efetivamente concluída.
- Inserir item em `sga_sync_queue` com `payload.force_resync_media=true` para o veículo LQD7A71 → o cron pega no próximo ciclo e sobe as 34 fotos ao Hinova (dedup por `sga_fotos_enviadas` mantém os 8 docs intactos).
- Log de auditoria descrevendo o saneamento.

### 2. Correção sistêmica (migration + edge)

**Migration**: corrigir o trigger que cancela a autovistoria quando a presencial assume. Em vez de marcar `cancelada`, marcar `aprovada` (estado terminal "positivo") quando há vistoria presencial concluída no mesmo veículo. Isso preserva as fotos como elegíveis para sync e respeita a regra canônica "uma vistoria por veículo".

**Edge `sga-hinova-sync`**: defesa extra — ampliar o filtro do coletor de fotos para também aceitar `vistorias.status='cancelada'` **quando existir** `instalacoes.status='concluida'` para o mesmo veículo. Fotos boas nunca devem ser ignoradas por causa de transição de estado da vistoria.

### 3. Varredura histórica (insert tool — leitura)
Identificar outros veículos com o mesmo padrão (`vistorias.status='cancelada'` + `instalacoes.status='concluida'` + zero fotos em `sga_fotos_enviadas` com `origem='vistoria_fotos'`). Relatar contagem; se for pequena, reenfileirar com `force_resync_media`.

### Fora de escopo
- Não mexer no fluxo de aprovação do Monitoramento — a aprovação em si foi correta.
- Não alterar o `recompute_cotacao_status_contratacao` (separe do bug "status=rascunho" anterior — embora também presente neste caso, fica para outra iteração se você quiser).
- Memória: atualizar `mem://logic/operations/historico-fotos-veiculo-canonico` para registrar que vistoria de autovistoria substituída por presencial deve terminar em `aprovada`, não `cancelada`.
