# Revisão completa do endpoint de cadastro no SGA (Hinova)

## Objetivo

Reescrever `supabase/functions/sga-hinova-sync/index.ts` (2009 linhas, com lógica acumulada de patches) em uma orquestração linear, previsível e fiel à documentação oficial Hinova:

1. **Autenticar** → token de usuário
2. **Buscar associado por CPF** (`GET /associado/buscar/{cpf}/cpf`)
   - Se existir → reusa `codigo_associado` e a lista de `veiculos` retornada
   - Se não existir → **Cadastrar associado** (`POST /associado/cadastrar`) e captura `codigo_associado`
3. **Buscar veículo por placa/chassi** (`GET /veiculo/buscar/:placaOuChassi/:buscar_por`)
   - Se existir e pertencer ao associado → reusa `codigo_veiculo`
   - Se não existir → **Cadastrar veículo** vinculado ao `codigo_associado` (`POST /veiculo/cadastrar`) e captura `codigo_veiculo`
4. **Cadastrar fotos** vinculadas ao `codigo_veiculo` (`POST /veiculo/foto/cadastrar`), em lotes de até 50
5. Persistir `codigo_hinova` em `associados` e `veiculos`, marcar fila como concluída

Todo o resto (loops de recovery por logs, 3 estratégias paralelas de busca, fallbacks por endpoints inexistentes, etc.) é removido — a busca oficial é a regra única.

## Arquitetura

```text
┌─────────────────────────────────────────────────────────┐
│ sga-hinova-sync/index.ts (orquestrador, ~250 linhas)    │
│   - valida entrada, carrega credenciais                 │
│   - guard idempotência + lock                           │
│   - chama steps em ordem, propaga códigos               │
└─────────────────────────────────────────────────────────┘
        │ usa
        ▼
┌─────────────────────────────────────────────────────────┐
│ _shared/hinova-client.ts (já existe — expandir)         │
│   - autenticar()                                        │
│   - buscarAssociadoPorCpf(cpf)                          │
│   - cadastrarAssociado(payload)                         │
│   - buscarVeiculoPorPlaca(placa)  [já existe]           │
│   - buscarVeiculoPorChassi(chassi)                      │
│   - cadastrarVeiculo(payload)                           │
│   - cadastrarFotosVeiculo(codigoVeiculo, fotos[])       │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ _shared/hinova-payloads.ts (NOVO)                       │
│   - buildAssociadoPayload(associado, ctx)               │
│   - buildVeiculoPayload(veiculo, codAssoc, plano, ctx)  │
│   - buildFotosPayload(documentos[], mapeamentos)        │
└─────────────────────────────────────────────────────────┘
```

Cada função do client retorna um objeto tipado `{ ok, codigo?, raw, status }` — sem lançar exceções "transparentes". O orquestrador decide o que fazer com cada resultado.

## Fluxo do orquestrador (pseudocódigo)

```text
1. validateInput(veiculo_id, associado_id, status_sga_destino)
2. loadCredenciais()  // env > banco > falha
3. idempotencyGuard(veiculo)  // já sincronizado? sair com sucesso
4. acquireLock(veiculo)  // status_sga = 'sincronizando'

5. associado = db.getAssociado(associado_id)
   guardBaseAntiga(associado)  // mantém regra atual
   veiculo   = db.getVeiculo(veiculo_id)
   contrato  = db.getContrato(veiculo_id || associado_id)
   resolveVendedor(contrato)  // codigo_sga_voluntario obrigatório

6. token = hinova.autenticar()

7. // PASSO ASSOCIADO — busca antes de cadastrar
   busca = hinova.buscarAssociadoPorCpf(cpf)
   if busca.encontrado:
       codigoAssociado = busca.codigo_associado
       // tentar reaproveitar veículo da lista retornada
       vExistente = busca.veiculos.find(v => normalizePlaca(v.placa) === placa)
       if vExistente: codigoVeiculo = vExistente.codigo_veiculo
   else:
       payload = buildAssociadoPayload(associado, contexto)
       res = hinova.cadastrarAssociado(payload)
       if !res.ok: failQueue('associado', res.erro); return
       codigoAssociado = res.codigo_associado

   db.update(associados, { codigo_hinova: codigoAssociado, sincronizado: true })

8. // PASSO VEÍCULO — busca antes de cadastrar
   if !codigoVeiculo:
       busca = hinova.buscarVeiculoPorPlaca(placa) || hinova.buscarVeiculoPorChassi(chassi)
       if busca.encontrado && busca.codigo_associado == codigoAssociado:
           codigoVeiculo = busca.codigo_veiculo
       else if busca.encontrado:
           failQueue('veiculo', 'placa pertence a outro associado no Hinova'); return
       else:
           payload = buildVeiculoPayload(veiculo, codigoAssociado, plano, contexto)
           res = hinova.cadastrarVeiculo(payload)
           if !res.ok: failQueue('veiculo', res.erro); return
           codigoVeiculo = res.codigo_veiculo

   db.update(veiculos, { codigo_hinova: codigoVeiculo, status_sga: destino })

9. // PASSO FOTOS
   docs = db.getDocumentos(associado_id, veiculo_id)
   fotos = buildFotosPayload(docs, mapeamentos)  // descarta sem URL ou sem mapeamento
   for batch of chunks(fotos, 50):
       hinova.cadastrarFotosVeiculo(codigoVeiculo, batch)

10. markQueueCompleted(); logSync('sync_completo', success)
```

## Mudanças no payload (alinhar 100% com docs)

### Associado (`POST /associado/cadastrar`)
Campos enviados (todos validados antes):
`nome, cpf (numérico), rg, data_nascimento (dd/mm/yyyy), sexo (M|F), logradouro, numero, complemento, bairro, cidade, estado (sigla), cep (numérico), codigo_conta, dia_vencimento, telefone, celular, email, codigo_regional, codigo_cooperativa, codigo_voluntario (do vendedor), codigo_tipo_cobranca_recorrente, codigo_como_conheceu, codigo_profissao, data_contrato`

Removidos: payloads inflados que a Hinova ignora ou rejeita.

### Veículo (`POST /veiculo/cadastrar`)
`codigo_associado, ano_fabricacao, ano_modelo, codigo_tipo_veiculo, kilometragem, chassi, numero_motor, codigo_fipe, codigo_voluntario, dia_vencimento, renavam, placa (vazio se 0KM), codigo_combustivel, codigo_cor, codigo_cota, codigo_conta, valor_fipe, valor_adesao, data_contrato, codigo_situacao, codigo_cooperativa, produtos[]`

`produtos[]` segue o formato oficial `[{ codigo_produto: N }, ...]` (não `produtos_vinculados` com `valor` — ajustar conforme docs).

### Fotos (`POST /veiculo/foto/cadastrar`)
Por lote de ≤50, formato exato:
```json
{ "codigo_veiculo": N, "foto": [{ "nome_arquivo", "codigo_tipo", "link" }] }
```

## Remoções (limpeza)

- 3 estratégias concorrentes de busca por CPF (`/associado/buscar/cpf`, `/associado/consultar`, `/associado/buscar` POST) → manter **só** `GET /associado/buscar/{cpf}/cpf` (é o documentado).
- Loop de "recovery por logs/identidade" em 4 estratégias → desnecessário, pois a busca oficial sempre roda primeiro.
- Detector de "loop infinito CPF duplicado" → não acontece mais (busca substitui a tentativa cega).
- Fallback `formatCPF` em URL → spec diz "999.999.999-99 ou somente números"; padronizar em **somente números**.
- Inferência de `codigo_conta` por histórico de logs → manter só ENV/banco; falhar com mensagem clara se ausente.

## Mantido (regras de negócio existentes)

- Guard de idempotência (`sincronizado_hinova && codigo_hinova`)
- Lock por `status_sga='sincronizando'` com stale-lock recovery (5min)
- Guard `origem_cadastro='api_externa'` (base antiga não reenvia)
- Resolução obrigatória de `codigo_sga_voluntario` do vendedor real do contrato
- Resolução de `codigo_sga_plano` numérico estrito
- Downgrade de `ativo`→`pendente` quando veículo tem Roubo/Furto sem aprovação técnica
- Auditoria em `logs_auditoria` da decisão SGA
- `sga_sync_queue` para reenvio com backoff e `falha_permanente` após 10 tentativas
- Mapeamentos via tabela `hinova_mapeamentos` (cor, combustível, tipo_veiculo, tipo_foto)
- Trigger DB que mantém `veiculos.associado_id == contratos.associado_id`

## Tratamento de erros (uniforme)

Tabela de decisão por erro do Hinova:

| Cenário | Ação |
|---|---|
| 401/token expirado | reautenticar 1x; se persistir → fila com `etapa='auth'` |
| Associado: CPF duplicado | (não deve mais ocorrer — busca antes) → fallback: re-buscar; se nada → `falha_permanente` |
| Associado: 4xx validação | `falha_permanente` com mensagem completa (campos inválidos) |
| Veículo: placa/chassi duplicado em outro associado | `falha_permanente` "veículo pertence a outro CPF no Hinova" |
| Veículo: associado não cadastrado | invalidar `codigo_hinova` local, requeue etapa `associado` |
| Fotos: erro parcial | reenfileirar etapa `fotos` com `codigo_associado_hinova` e `codigo_veiculo_hinova` já gravados |
| Rede/timeout | retry exponencial (3x), depois fila |

## Detalhes técnicos

- **Arquivo principal**: `supabase/functions/sga-hinova-sync/index.ts` reescrito (~300 linhas, era 2009).
- **Novos helpers**: `supabase/functions/_shared/hinova-payloads.ts` e expansão de `_shared/hinova-client.ts` com `autenticar`, `buscarAssociadoPorCpf`, `cadastrarAssociado`, `buscarVeiculoPorChassi`, `cadastrarVeiculo`, `cadastrarFotosVeiculo`.
- **Compatibilidade**: contrato de entrada idêntico (`{veiculo_id, associado_id, status_sga_destino?, ...}`) e mesma resposta `202 {success, status:'processing'}`. Nenhum chamador front/edge precisa mudar.
- **Logs**: mesmo schema de `sga_sync_logs` (action/status/payload), mas com `action` enxutos: `autenticar | buscar_associado | cadastrar_associado | buscar_veiculo | cadastrar_veiculo | enviar_fotos | sync_completo`. Diagnósticos `busca_cpf_diagnostico`/`recovery_*` saem.
- **Idempotência reforçada**: o passo "buscar antes de cadastrar" elimina a maior parte dos casos de duplicidade que motivaram os patches anteriores (ex.: KOS1G37, deadlock de CPF).
- **Reaproveitamento da lista de veículos do associado**: quando o `GET /associado/buscar/{cpf}/cpf` retorna `veiculos[]`, varremos por placa para reusar `codigo_veiculo` sem cadastrar de novo (corrige caso "associado existe, veículo dele já existe").

## Validação após deploy

1. Reprocessar a fila de `sga_sync_queue` com status `pendente`/`falha_permanente` para casos similares ao KOS1G37.
2. Rodar uma cotação de teste end-to-end (associado novo + associado existente + veículo novo + veículo existente).
3. Conferir em `sga_sync_logs` que cada veículo gera no máximo: `autenticar → buscar_associado → (cadastrar_associado?) → buscar_veiculo → (cadastrar_veiculo?) → enviar_fotos → sync_completo`.

## Memória

Atualizar `mem://architecture/activation/single-source-activation` (já existe) e criar `mem://integrations/sga/cadastro-fluxo-canonico` documentando: "buscar antes de cadastrar é regra única; nenhuma estratégia paralela de recovery; payloads conforme docs Hinova v2".

## Fora do escopo

- Não alteramos `sga-buscar-associado-completo` (consulta usada na cotação).
- Não alteramos cron de retry (`cron-sga-retry`) — continua chamando este endpoint.
- Não alteramos schema do banco (apenas reuso das colunas existentes).
