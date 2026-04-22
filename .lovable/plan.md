

## Isolar sincronização financeira aos veículos da base antiga

### Diagnóstico

| Origem | Associados | Veículos | Comportamento desejado |
|---|---|---|---|
| `api_externa` (base antiga importada) | 9.496 | 9.621 | Sincronização financeira **ATIVA** (mapear placa → buscar boletos) |
| `interno` (cotação nova) | 41 | 41 | Sincronização financeira **DESATIVADA**. Vão ao SGA via `sga-hinova-sync` (envio, não leitura) |

**Chave de diferenciação confirmada**: `associados.origem_cadastro`. Não precisa de coluna nova.

### Problema atual

1. `sga-mapear-codigos-veiculos` busca por placa para **TODO** veículo sem `codigo_hinova` — incluindo os 38 internos que ainda não foram enviados ao SGA. Isso polui a fila com `sem_historico_hinova` falsos.
2. `sga-backfill-financeiro` (enfileirar) seleciona qualquer veículo com `codigo_hinova` + associado com `codigo_hinova`. Quando um veículo `interno` for enviado ao SGA via `sga-hinova-sync`, ele entra no backfill financeiro do dia seguinte — não deveria, pois sua origem é o próprio sistema novo.
3. Risco de duplicidade: se um veículo `interno` cair no `sga-mapear-codigos-veiculos` por placa antes de ser enviado, ele pode ganhar um `codigo_hinova` de um homônimo da base antiga (placa reutilizada/coincidência). Hoje não há guard.

### Mudanças

**1. `supabase/functions/sga-mapear-codigos-veiculos/index.ts`**
- No SELECT, juntar com `associados!inner(origem_cadastro)` e filtrar `origem_cadastro = 'api_externa'`.
- Veículos `interno` nunca entram no mapeamento por placa.

**2. `supabase/functions/sga-backfill-financeiro/index.ts`**
- Na ação `enfileirar`: filtrar `associados.origem_cadastro = 'api_externa'`.
- Na ação `status`: separar contagens "elegíveis (base antiga)" vs "internos (não elegíveis)" para o painel ficar honesto.

**3. `supabase/functions/cron-sga-sync-financeiro-diario/index.ts`**
- Sem mudança de lógica (já chama o orquestrador), mas comentário explicando que afeta apenas base antiga.

**4. `supabase/functions/sga-hinova-sync/index.ts`** (envio para SGA — base nova)
- Adicionar guard: se associado já tem `codigo_hinova` E `origem_cadastro = 'api_externa'`, **bloquear envio** com erro claro ("Associado pertence à base antiga, não pode ser reenviado"). Evita duplicidade no SGA.
- Após criar com sucesso, marcar `sincronizado_hinova=true` (já faz) — esses ficam fora do backfill por NÃO serem `api_externa`.

**5. `src/components/cadastro/SgaBackfillFinanceiroDialog.tsx`**
- Texto do dialog: deixar explícito "Sincroniza apenas veículos da base antiga (importados via API). Veículos novos contratados pelo sistema são enviados ao SGA automaticamente após a contratação".
- Mostrar 2 contadores: `Elegíveis (base antiga)` e `Sistema novo (não sincronizam)`.

**6. Limpeza pontual (script de manutenção via SQL)**
- Marcar como `cancelado` os jobs em `sga_sync_financeiro_jobs` cujo veículo pertença a associado `interno` (limpeza histórica, não recorrente). Status novo `cancelado` adicionado ao CHECK constraint.

### Critérios de aceitação

1. Painel mostra "Elegíveis: 9.621 / Sistema novo: 41 (não sincronizam)".
2. Próxima execução do cron diário não cria jobs para nenhum veículo `interno`.
3. `sga-mapear-codigos-veiculos` ignora veículos `interno`.
4. Tentativa de chamar `sga-hinova-sync` para associado `api_externa` retorna erro de duplicidade.
5. Veículos novos contratados pelo fluxo de cotação seguem indo ao SGA via `sga-hinova-sync` normalmente (envio, não leitura).
6. Jobs antigos pendentes de veículos `interno` ficam marcados como `cancelado` e somem das métricas de erro.

### Fora de escopo

- Reescrever `sga-hinova-sync` (apenas adiciona guard).
- Migrar histórico financeiro dos 41 internos (não aplicável — eles geram cobranças no sistema novo, não no SGA).

