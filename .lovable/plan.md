## O que aconteceu com o associado CASSIO LAZARO — veículo LMX5A90

### Linha do tempo reconstruída a partir de `logs_auditoria`, `instalacao_prestador_links` e tabelas operacionais

| Data/Hora (BRT-3) | Evento | Fonte |
|---|---|---|
| 22/04 18:39 | Contrato `CTR-20260422213919-HAMGD5` criado | contratos |
| 24/04 09:35 | Serviço de instalação `cc991c24` criado | servicos |
| 30/04 15:28 | Monitoramento atribui instalação ao prestador SHALOM CAR (link `b40587c8`) | instalacao_prestador_links |
| 30/04 16:04 | Prestador conclui o link: 31 fotos OK, checklist OK, assinatura OK. **Link público de prestador NÃO tem campos para IMEI/serial/rastreador** | instalacao_prestador_links + auditoria |
| 30/04 16:04 | Triggers fecham vistoria, serviço vistoria_entrada, serviço instalação e `instalacoes.concluida_em` | auditoria |
| 05/05 16:14 | SGA sincroniza veículo (`status_sga = ativado_sga`) | auditoria |
| **07/05 15:31** | **`ativar-associado` promove contrato e veículo a `ativo`** — porém o rastreador IMEI `862667083450315` (Softruck) continuou em `estoque`, sem `veiculo_id`/`associado_id` e sem nenhuma chamada para `softruck-ativar-dispositivo` | auditoria + rastreadores |
| **16/05 19:06** | Alguém clica em **Realocar** no serviço `cc991c24` com motivo "teste". A observação registra `REALOCADO->FILA (reagendamento_operacional) por 6ea6ef55-…`. O RPC aceita reabrir um serviço `concluida` e cascateia: instalação volta a `agendada`, contrato `ativo → assinado`, veículo `ativo → instalacao_pendente`, `cobertura_total true → false` | auditoria |
| 19/05 11:58 | Trigger autopreenche `vistorias.veiculo_id` (estava nulo) | auditoria |
| 19/05 12:00 | Nova sincronização SGA disparada (`pendente_sga`) | auditoria |

### Estado atual (incoerente)

- `vistorias 5efff1eb` → `concluida` (vistoria do prestador fechada em 30/04, intocada)
- `servicos 80b0fcf1` (vistoria_entrada) → `concluida`
- `servicos cc991c24` (instalacao) → `agendada` (reaberto em 16/05)
- `instalacoes 3ae909be` → `agendada`, `concluida_em = null`, `rastreador_id = null`, `imei_rastreador = null`
- `contratos 3388240f` → `assinado` (foi `ativo`)
- `veiculos LMX5A90` → `instalacao_pendente`, `cobertura_total = false`, `cobertura_roubo_furto = true`
- `rastreadores 71fa60bb` (IMEI 862667083450315) → `estoque`, sem veículo/associado e sem `softruck-ativar-dispositivo`

Ou seja: o prestador fez a vistoria e fisicamente instalou o rastreador, mas o **sistema nunca registrou o vínculo do equipamento** e depois um operador, em teste, **rebobinou um contrato já ativo havia 9 dias** apenas reabrindo o serviço de instalação.

---

## Causas-raiz (3 bugs)

**Bug A — `realocar_servico` aceita reabrir serviço `concluida`.**  
A regra documentada (mem `realocar-servico-reabertura`) diz que só `cancelada` é reabertura controlada e que `concluida/aprovada/reprovada/aprovada_ressalvas` devem bloquear. O log mostra que um serviço `concluida` foi para `agendada`.

**Bug B — Reabrir serviço de instalação cascateia desativando contrato/veículo já ATIVOS.**  
Algum trigger pós-realocação reverteu `contratos.status` de `ativo` para `assinado` e `veiculos.status` de `ativo` para `instalacao_pendente` (`cobertura_total` para false). Isso fere a memória `single-source-activation`: ativação/desativação deve passar por `ativar-associado` com lock+CAS+log — nunca por trigger de realocação operacional. Não há justificativa funcional para realocar derrubar um associado já em vigência.

**Bug C — Link público do prestador (`instalacao_prestador_links`) não captura IMEI/serial/plataforma do rastreador.**  
A tabela só guarda fotos, checklist e assinatura. A edge `concluir-instalacao-prestador` fecha a vistoria sem materializar o vínculo do equipamento, e o guard de DB `veiculo-ativo-exige-rastreador-guard-db` falhou em barrar a promoção a `ativo` em 07/05 (FIPE R$ 49.238, gasolina, exige rastreador).

---

## Plano de correção

### 1. Saneamento dos dados deste caso (manual, com log)
- Restaurar `instalacoes 3ae909be` para `concluida` com `concluida_em = 30/04/2026 19:04:17`.
- Restaurar `servicos cc991c24` para `concluida` e limpar a observação "REALOCADO… teste".
- Reativar `contratos 3388240f` (`status = ativo`, `data_ativacao = 07/05`) e `veiculos LMX5A90` (`status = ativo`, `cobertura_total = true`) via edge `ativar-associado` (NÃO via UPDATE direto) — para passar pelo lock/CAS/log.
- Vincular `rastreadores 71fa60bb` ao `veiculo_id 3a05032d…` e `associado_id 5d907065…` chamando `softruck-ativar-dispositivo` com o IMEI `862667083450315`. Se o equipamento já está pontuando na Softruck, marcar `status='instalado'` e gravar `id_plataforma`.
- Disparar nova sincronização SGA para refletir o estado correto.

### 2. Corrigir Bug A — RPC `realocar_servico`
Auditar a função (provavelmente em `supabase/functions/_shared` ou migration) e:
- Bloquear explicitamente realocação quando `status IN ('concluida','aprovada','reprovada','aprovada_ressalvas')`, devolvendo erro tipado.
- Adicionar teste em `supabase/functions/*/tests` cobrindo tentativa de realocar `concluida` (esperar 409/erro).

### 3. Corrigir Bug B — desativação em cascata
- Remover, do trigger pós-realocação, qualquer UPDATE em `contratos.status`, `veiculos.status` e `veiculos.cobertura_total` quando o serviço sendo realocado for de `instalacao` e o contrato já estiver `ativo`. Realocação só pode mexer em `servicos`/`instalacoes`/`agendamentos_base`.
- Reafirmar invariante: transições para/de `ativo` só via `ativar-associado` / `cancelar-adesao-nao-instalada` — adicionar guard de DB que bloqueia UPDATE direto em `contratos.status` saindo de `ativo` quando o motivo não vier carimbado.

### 4. Corrigir Bug C — captura de rastreador no link do prestador
- Adicionar colunas em `instalacao_prestador_links`: `rastreador_imei text`, `rastreador_serial text`, `rastreador_plataforma text` (validado contra enum existente).
- Atualizar a UI pública do prestador (form de conclusão) para exigir IMEI antes de finalizar quando a instalação for de veículo que exige rastreador (Diesel / FIPE≥30k carro / FIPE≥9k moto).
- Atualizar `concluir-instalacao-prestador` para:
  1. Validar IMEI contra `rastreadores` (status `estoque`, mesma plataforma).
  2. Chamar `softruck-ativar-dispositivo` (ou `rede-veiculos-vincular-cliente`) com `veiculoId`/`associadoId`.
  3. Persistir `instalacoes.rastreador_id` e `instalacoes.imei_rastreador`.
  4. Em caso de falha de integração, manter a instalação `agendada` e devolver erro à UI do prestador — não materializar conclusão sem vínculo.
- Confirmar que o guard `trg_guard_veiculo_ativo_exige_rastreador` cobre o caminho do `ativar-associado` para evitar nova promoção a `ativo` sem rastreador.

### 5. Verificação
- Após cada correção, rodar `supabase--test_edge_functions` nos testes novos.
- Refazer o cenário em ambiente: prestador conclui sem IMEI → bloqueio; conclui com IMEI → vínculo na Softruck + `instalacoes.concluida_em` populado; tentativa de realocar `concluida` → erro.
- Replay do caso real: rodar saneamento e conferir que o associado volta para `ativo`, veículo `cobertura_total=true`, rastreador `instalado` com `veiculo_id` preenchido.

### Fora do escopo
- Mudar fluxo do prestador para também capturar fotos do rastreador (instalado/desinstalado) — pode ser pedido em outro PR.
- Revisar outros casos históricos com mesmo sintoma (rastreador em estoque + veículo já ativo) — sugiro um script de auditoria depois que o Bug C estiver corrigido.
