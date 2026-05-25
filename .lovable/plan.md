
## O que aconteceu com LSA7A65 (COT-20260521-150643240-471)

Cronologia reconstituída a partir de `logs_auditoria`, `servicos`, `instalacoes`, `instalacao_prestador_links` e `agendamentos_base`:

| Hora (BRT) | Ator | Evento |
|---|---|---|
| 21/05 15:23 | Sistema | `criar-instalacao-pos-pagamento` cria `instalacoes` (a5dabcef…) + `servicos` (673ac27a…) tipo `instalacao` agendados p/ 25/05 manhã, e cria `agendamentos_base` correspondente |
| 21/05 15:31 | Sistema | Contrato vira `cadastro_aprovado=true` (vistoria base presencial agendada) |
| 22/05 09:27 | [TESTE] Vistoriador | Cria `vistorias` (em_analise) ligada à instalação |
| **25/05 11:05** | Coordenador (59ca886d…) | Atribui ao prestador externo LEONARDO TORINO MATOSO → `instalacao_prestador_links` (60110112…) criado, escopo `fotos_instalacao`, **status `em_rota`** (LEONARDO aceitou às 11:05:49 e iniciou rota às 11:05:53) |
| **25/05 11:11** | Kleytonn (9670a9fc…) | `realocar_servico('fila', motivo='PRESTADOR FAZENDO AGORA')` |
| 25/05 11:12 | Kleytonn | `realocar_servico('fila', motivo='PRESTADOR')` |
| 25/05 11:14 | Kleytonn | `realocar_servico('fila', motivo='PRESTADOR')` (data → 26/05, depois 25/05 manhã de novo) |

## Estado atual (anomalia)

- `servicos.673ac27a…`: `status='agendada'`, `profissional_id=NULL`, sem `rota_id`, sem `local_vistoria` — tecnicamente "na fila"
- `instalacoes.a5dabcef…`: `status='agendada'`, `instalador_responsavel_id=NULL`, `vistoriador_prestador_id=NULL`
- `veiculos.LSA7A65`: `status='instalacao_pendente'` (correto)
- `agendamentos_base`: **0 registros vivos** para essa instalação (todos foram cancelados pelo `realocar_servico`)
- `instalacao_prestador_links.60110112…`: **ainda `em_rota`**, com `aceito_em` e `em_rota_em` preenchidos — link ativo apontando para o LEONARDO

## Onde o serviço "sumiu"

1. **Atribuição Manual (Monitoramento)** lê de `agendamentos_base` filtrando contratos com `aprovado_em` (regra canônica `mem://logic/operations/atribuicao-manual-gate-cadastro-aprovado`). Como o `realocar_servico` **cancelou** o `agendamentos_base` existente e **não criou** um novo no destino `fila`, o serviço desapareceu da fila visível.
2. **Mapa / `PrestadoresAtivos`** ainda vê o link `em_rota` do LEONARDO e mostra ele "executando", mas a instalação por trás está sem profissional → estado fantasma.
3. **Aprovação de Associados** não recebe (instalação não foi concluída e não há vistoria fechada).

## Causa raiz no `realocar_servico`

A função pública `public.realocar_servico` (235 linhas):

- limpa `instalacoes.vistoriador_prestador_id` e `instalador_responsavel_id` ✅
- limpa `servicos.profissional_id` ✅
- cancela todos `agendamentos_base` da instalação (linhas 136–143) ✅
- só cria novo `agendamentos_base` quando destino = `'base'` (linhas 163–179)
- **NUNCA toca em `instalacao_prestador_links`** ❌
- não recria nem reabre `agendamentos_base` para destino `'fila'` ou `'rota'` ❌

Resultado: link do prestador fica vivo (rompe a regra canônica `mem://logic/operations/atribuicao-prestador-status-sync`) e, quando destino é `fila`, o serviço some da fila operacional do Monitoramento.

## Plano de correção

### 1. Saneamento do caso LSA7A65 (migration única)

- Cancelar `instalacao_prestador_links.60110112-3c21-45f0-8389-51ed3c4756f0` (`status='cancelado'`, marcando `recusa_motivo='realocado_para_fila_em_25/05'`) para o trigger canônico cuidar do reflexo.
- Reabrir um `agendamentos_base` para `instalacao_id = a5dabcef…` com `status='agendado'`, `data_agendada=2026-05-25`, `horario='09:00'`, sem `oficina_id` nem `atendido_por` (representando "fila do Monitoramento"). Modelo já usado pelo branch destino=`base`, adaptado sem oficina.
- Log em `associados_historico` com ação `saneamento_lsa7a65`.

### 2. Patch estrutural em `public.realocar_servico`

Migration que substitui a função `realocar_servico` adicionando:

- **Cancelamento do link prestador ativo** sempre que o destino NÃO é `'profissional'` apontando para o mesmo prestador:
  ```sql
  UPDATE public.instalacao_prestador_links
     SET status = 'cancelado',
         updated_at = now(),
         recusa_motivo = COALESCE(recusa_motivo,'') ||
           ' [realocado para ' || _destino || ' por ' || _uid::text || ': ' || _motivo || ']'
   WHERE instalacao_id = _servico.instalacao_origem_id
     AND status IN ('pendente','aceito','em_rota','chegou','iniciada');
  ```
  Isso reaproveita o trigger canônico que já devolve serviço à fila quando link é cancelado, mantendo consistência.

- **Recriação de `agendamentos_base` para destino `'fila'` e `'rota'`** (sem `oficina_id`/`atendido_por`), espelhando o padrão já existente para `'base'`. Sem essa entrada, `useServicosParaAtribuir` não enxerga o serviço.

- Manter compatibilidade com chamadas existentes (mesma assinatura, mesmo retorno JSON).

### 3. Regressões a validar manualmente após deploy

- Realocar um serviço de prestador → `fila`: link some do mapa, serviço reaparece em Atribuição Manual.
- Realocar mesmo serviço → `profissional` (mesmo prestador): link **não** é cancelado (caminho oposto).
- Realocar → `base`: comportamento atual preservado (cria agendamento na oficina).
- Realocar → `rota`: novo agendamento_base sem oficina é criado e fica visível na rota.

### 4. Memória

Adicionar memória `mem://logic/operations/realocar-servico-cancela-link-prestador` documentando que `realocar_servico` cancela o `instalacao_prestador_links` ativo e sempre garante 1 `agendamentos_base` vivo por destino — virando regra canônica para complementar `mem://logic/operations/atribuicao-prestador-status-sync` e `mem://logic/operations/dedupe-agendamentos-rule`.

### Detalhes técnicos (resumo para revisão)

```text
realocar_servico(destino)
├── 'profissional' → mantém link se _profissional_id == link.prestador_id; senão cancela
├── 'fila'         → cancela link + cria agendamentos_base sem oficina/atendido_por
├── 'rota'         → cancela link + cria agendamentos_base sem oficina, com obs "Rota X"
└── 'base'         → cancela link + cria agendamentos_base com oficina (já existente)
```

Nada na UI muda; só DB. Sem mudança em rotas, hooks ou componentes.
