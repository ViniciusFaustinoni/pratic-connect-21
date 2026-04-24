# Por que a credencial "falha" (mesmo funcionando em outras ocasiões)

## Resumo do diagnóstico

A credencial **NÃO está errada**. O erro `"Acesso não autorizado. Verifique seu token de acesso" / "Login ou senha inválido"` que aparece em massa **não vem do `/usuario/autenticar`** — vem das chamadas seguintes (`/veiculo/consultar/placa/...`, `/buscar/situacao-financeira-veiculo/...`, `/listar/boleto-associado-veiculo`).

O erro é causado por **duas falhas estruturais introduzidas na última refatoração**, não pela credencial.

## Evidências (fila atual de 208k jobs)

| Erro | Ocorrências | Causa real |
|---|---|---|
| `Hinova autenticação falhou (200): Usuário com restrição de horário` | 260 | Janela horária do usuário SGA (a Hinova classifica isso como sucesso HTTP=200, com erro embarcado no body) — **nada a ver com credencial** |
| `[server] HTTP 406: É necessário enviar ao menos uma data inicial e uma final` | 131 | Endpoint `listar/boleto-associado-veiculo` rejeitou os parâmetros de data — **bug de payload em janela específica**, não credencial |
| `[auth] Auth recusada (http=401)` em vários helpers (`listarBoletos`, `buscarSituacaoFinanceira`, `buscarVeiculoPorPlaca`) | **210 somados** | **Token cacheado invalidado por outra instância (race condition do cache global)** |
| `Edge Function returned a non-2xx status code` | 2 | Cold start / timeout |
| `Falha ao gravar 28 boletos: ON CONFLICT…` | 1 | Resíduo do bug anterior, já corrigido |

**Total já importado**: 536 cobranças do SGA (até o momento). O sistema **funciona**, mas a taxa de erro da camada de auth é alta demais.

## Causa raiz dos 401

1. **Cache global de `tokenUsuario` (`SESSION_TTL_MS = 25min`) é incompatível com o backfill paralelo.** A Hinova é stateful — cada novo `/usuario/autenticar` invalida o token anterior. Quando um cron ou outra instância da Edge Function faz um login novo, o token cacheado dentro de outra instância vira lixo. As próximas chamadas dessa instância pegam 401.

2. **Os helpers `buscarVeiculoPorPlaca`, `buscarSituacaoFinanceiraVeiculo`, `listarBoletosVeiculoJanela` usam `fetch` direto, não o wrapper `hinovaFetch`.** O wrapper foi escrito (linhas 224-259 de `hinova-client.ts`) e tem reauth automática em 401, **mas nenhum helper o usa**. Resultado: quando o token cacheado morre, o 401 é apenas lançado como `HinovaTransientError` e o job vai para `pendente_retry` em vez de reautenticar e prosseguir.

3. **Não há reauth no helper `buscarAssociadoPorCpf`** dentro de `sga-sync-financeiro-veiculo/index.ts` (linhas 60-93) — chama `fetch` cru com `session.tokenUsuario`.

## Por que `sga-hinova-sync` (cadastro de associado/veículo) "sempre funciona"

Porque ele faz `autenticarHinova` **uma vez por requisição** (linhas 910-937) e usa o token recém-obtido até o fim da requisição. Não compartilha cache entre instâncias, então não sofre invalidação cruzada.

---

# Plano de correção

## 1. Remover o cache global de `tokenUsuario` para o backfill financeiro
Trocar a estratégia: **uma autenticação por execução de job**, igual ao `sga-hinova-sync`. Isso elimina 100% dos 401 cruzados.

- `getHinovaSession` continua existindo, mas adiciona parâmetro `noCache?: boolean`.
- `sga-sync-financeiro-veiculo/index.ts` chama `getHinovaSession(supabase, { noCache: true })` para sempre autenticar fresco.
- Trade-off: aumenta logins (~1 por job), mas elimina o "Login ou senha inválido". Com 9.6k veículos e 1 login por job, são ~9.6k logins ao longo do backfill — distribuídos no tempo, sem contenção.

## 2. Wrapper `hinovaFetch` aplicado nos 3 helpers críticos
Refatorar para usar `hinovaFetch` (que já tem reauth em 401):
- `buscarVeiculoPorPlaca` (consultar + fallback)
- `buscarSituacaoFinanceiraVeiculo`
- `listarBoletosVeiculoJanela`
- `buscarAssociadoComVeiculosPorCpf`

Para suportar isso, `hinovaFetch` precisa receber a `session` opcional (para não disparar nova auth quando o caller já tem uma sessão fresca).

## 3. Refatorar `buscarAssociadoPorCpf` local em `sga-sync-financeiro-veiculo`
Trocar o `fetch` cru pelo helper `buscarAssociadoComVeiculosPorCpf` do shared (que já será wrappado).

## 4. Corrigir o 406 "É necessário enviar ao menos uma data inicial e uma final" (131 ocorrências)
Investigar `listarBoletosVeiculoJanela`: hoje envia 4 campos de data (`data_vencimento_inicial/final` + `data_inicial/final`). Algumas versões da API rejeitam o conjunto. Ajustar para enviar **apenas** `data_inicial` + `data_final` (formato dd/mm/aaaa) — a documentação base confirma esse par.

## 5. Resetar jobs `pendente_retry` causados por auth para `pendente`
Migration única para limpar a fila contaminada:

```sql
UPDATE sga_sync_financeiro_jobs
SET status = 'pendente',
    proximo_retry_em = NULL,
    ultimo_erro = NULL
WHERE status = 'pendente_retry'
  AND ultimo_erro LIKE '%[auth]%';
```

(NÃO resetar os de `restrição de horário` — esses precisam aguardar a janela do usuário SGA reabrir.)

## 6. (Opcional, recomendado) Pedir ao SGA Hinova para ampliar a janela horária do usuário
260 falhas hoje são literalmente porque o usuário SGA configurado tem **horário restrito de operação**. A Hinova retorna HTTP 200 com `{"mensagem":"Usuário com restrição de horário..."}`. Isso não é bug nosso — é configuração do usuário no painel SGA. Vale validar com o suporte Hinova se o usuário do backfill pode ficar 24/7.

---

# Arquivos afetados

```text
supabase/functions/_shared/hinova-client.ts            (refatoração principal)
supabase/functions/sga-sync-financeiro-veiculo/index.ts (noCache + usar helper compartilhado)
supabase/migrations/<novo>.sql                          (reset jobs pendente_retry de auth)
```

---

# Validação após deploy

1. Limpar contadores antigos e disparar "Forçar sync agora".
2. Em 5 min, esperar:
   - **Zero** ocorrências de `[auth] Auth recusada (http=401)` em `sga_sync_financeiro_jobs.ultimo_erro`.
   - **Zero** ocorrências de `HTTP 406: É necessário enviar... data inicial`.
   - `cobrancas` (origem=sga_hinova) crescendo a cada minuto.
   - `concluido` subindo de 17 → centenas.
3. Os 260 jobs com "restrição de horário" devem permanecer em `pendente_retry` até a janela do usuário Hinova abrir — comportamento esperado.

---

# Riscos / Reversão

- **Risco**: aumento de logins (1 por job em vez de 1 por instância). Mitigação: a Hinova não documenta rate limit em `/usuario/autenticar`, e o `sga-hinova-sync` já opera nesse modelo desde sempre sem problema.
- **Reversível**: basta restaurar `getHinovaSession` para ignorar `noCache`.
