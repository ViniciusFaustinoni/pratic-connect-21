## Diagnóstico — INS-2026-00049 (Chevrolet Cruze KYB9G10, Leandro Reis)

Linha do tempo reconstruída a partir do banco:

```text
24/04 22:31  → Contratação cria:
                instalacoes 95ea4018  status=agendada  data=24/04 manhã  cotacao=a90a5276
                servicos    303a6411  status=agendada  tipo=instalacao   instalacao_origem_id=95ea4018

24/04 18:31  → Cliente agenda vistoria na BASE pelo fluxo público:
                agendamentos_base fbf36ada  cotacao_id=a90a5276  instalacao_id=NULL  ←  ❌ gap
                data=25/04 08:00

25/04 12:15  → Vistoriador (f6313b28) executa vistoria na base:
                vistorias bcf9aa4c  protocolo=VIS-2026-00013  origem=agendamento_base
                instalacao_id=NULL  ←  herda o gap

25/04 12:34  → Vistoria aprovada. Trigger e processar-vistoria encerram:
                ✅ vistorias.bcf9aa4c → aprovada
                ✅ agendamentos_base.fbf36ada → realizado
                ❌ instalacoes.95ea4018 → CONTINUA agendada
                ❌ servicos.303a6411  → CONTINUA agendada (vistoria_origem_id era NULL)
                
                Resultado: aparece como "Não atribuído / Agendada" no mapa
                e o técnico Wallace não viu a tarefa no app.
```

Causa raiz: `useAgendamentoBase.criar()` não busca a `instalacao_id` correspondente ao `cotacao_id` quando insere o `agendamentos_base`. Sem esse vínculo, todo o encerramento em cascata da vistoria fica órfão.

## Correções

### 1. Saneamento imediato deste caso (migration data-fix)
- `instalacoes.95ea4018` → `status=concluida`, `concluida_em=2026-04-25 12:34:53`
- `servicos.303a6411` → `status=concluida`, `concluida_em=2026-04-25 12:34:53`
- `vistorias.bcf9aa4c` → setar `instalacao_id=95ea4018` (rastreabilidade)
- `agendamentos_base.fbf36ada` → setar `instalacao_id=95ea4018` (rastreabilidade)

### 2. Saneamento defensivo de outros casos com mesmo padrão
Single-shot SQL: para todo `agendamentos_base` com `cotacao_id NOT NULL` e `instalacao_id IS NULL`, popular `instalacao_id` a partir da `instalacoes` (mais recente) com mesmo `cotacao_id`. Em seguida, encerrar instalações/serviços órfãos cuja vistoria associada já foi `aprovada`/`reprovada`/`cancelada`.

### 3. Fechar o gap na criação (frontend público)
Em `src/hooks/useAgendamentoBase.ts` (mutation de criação): antes do `INSERT` em `agendamentos_base`, buscar `instalacoes.id` por `cotacao_id` e incluir no payload. Idempotente — se não existir instalação ainda, segue com `null`.

### 4. Fechar o gap na decisão da vistoria (defesa em profundidade)
Em `supabase/functions/processar-vistoria/index.ts`, ao encerrar serviços/agendamentos da vistoria:
- Resolver `instalacao_id` por três caminhos (em ordem): `vistoria.instalacao_id` → `agendamentos_base.instalacao_id` (via `vistoria_id`) → `instalacoes` mais recente com `cotacao_id = vistoria.cotacao_id`.
- Se encontrado e a decisão for `aprovada`/`aprovada_com_ressalvas`: marcar `instalacoes.status=concluida` e `servicos.status=concluida` para o(s) serviço(s) com `instalacao_origem_id` igual e status ativo. Se `reprovada`/`cancelada`: marcar como `cancelada`.
- Logs explícitos por etapa.

### 5. Trigger de banco — espelho da regra (defesa final)
Estender o trigger `trg_sync_servico_on_vistoria_decisao` para também encerrar `instalacoes` e `servicos` resolvidos pela cadeia acima. Garante consistência mesmo se a edge falhar ou se a vistoria for decidida por SQL manual.

### 6. Verificação pós-deploy
- Conferir no banco que `instalacoes.95ea4018` e `servicos.303a6411` ficaram `concluida`.
- Listar quantos casos foram saneados pela migration de retroativos.
- Confirmar via UI (`/monitoramento/vistorias-instalacoes-mon`) que a busca por `KYB9G10` não mostra mais tarefa "Agendada / Não atribuído" para esse veículo.

## Arquivos afetados
- `src/hooks/useAgendamentoBase.ts` (gap #3)
- `supabase/functions/processar-vistoria/index.ts` (gap #4)
- Nova migration de data-fix + retroativos (#1, #2)
- Nova migration alterando o trigger (#5)

## Memória
Atualizar `mem://logic/operations/aprovacao-vistoria-encerra-servico.md` para incluir a regra: "ao decidir uma vistoria, também encerrar a `instalacoes` resolvida via vistoria → agendamento_base → cotação".
