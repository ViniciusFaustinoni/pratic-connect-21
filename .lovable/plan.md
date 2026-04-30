## Diagnóstico raiz

O link enviado (`/prestador/instalacao/447edd7c…`) corresponde ao registro `instalacao_prestador_links.id = b40587c8-9224-4856-8ea6-80d3eb7943ab`, vinculado à instalação `3ae909be-…` do veículo **LMX5A90**.

O prestador concluiu o trabalho normalmente:

- `instalacao_prestador_links.status = 'concluida'`
- `instalacao_prestador_links.fotos_vistoria` contém **19 fotos** (chave, motor, chassi, estepe, frente, bateria, odômetro, traseira, parabrisa, mala, banco_traseiro, banco_motorista, lateral_direita, painel_completo, banco_passageiro, lateral_esquerda, capo_aberto_placa, chave_roda_macaco e ainda mais).
- `instalacoes.status = 'concluida'`

Mas no módulo "Veículos" e nos detalhes do associado a aba "Fotos da Vistoria" aparece vazia. Confirmado por query: `vistorias_count = 0`, `vistoria_fotos_count = 0` para esse contrato.

### Por que vazio?

O hook que alimenta a aba (`useFotosVistoriaPorVeiculo` em `src/hooks/useVeiculoDetalhes.ts`) busca em **três tabelas encadeadas**: `contratos → vistorias → vistoria_fotos`. As fotos do prestador, porém, são salvas **somente** num jsonb em `instalacao_prestador_links.fotos_vistoria` pela edge `concluir-instalacao-prestador`. Essa edge:

1. Atualiza `instalacoes` para `concluida`.
2. Salva o jsonb no link.
3. Dispara sync com SGA / plataforma de rastreio.
4. **Nunca cria registro em `vistorias` nem em `vistoria_fotos`.**

Resultado: as fotos existem mas ficam isoladas no link público, sem ponte para o restante do sistema. A aba "Fotos/Docs" do veículo, os detalhes do associado e qualquer outro consumidor que use o caminho canônico `vistorias + vistoria_fotos` veem vazio.

Confirmação no banco: `1` link `concluida` com fotos hoje, `1` link órfão sem vistoria — ou seja, 100% dos casos atuais estão quebrados pelo mesmo motivo.

## Plano

### 1. Correção raiz na edge `concluir-instalacao-prestador`

Ao concluir, criar uma vistoria canônica e materializar cada foto do jsonb como linha em `vistoria_fotos`, dentro de uma transação lógica idempotente:

- **Idempotência**: antes de inserir, procurar `vistorias` existente por `instalacao_id = link.instalacao_id`. Se já existir, fazer upsert das fotos (excluir e reinserir as do tipo prestador, ou usar `tipo` único composto). Isso garante que reentregas/repostagens do mesmo link não dupliquem.
- **Insert em `vistorias`**:
  - `instalacao_id` = `link.instalacao_id`
  - `contrato_id` = `instalacoes.contrato_id`
  - `associado_id` = `instalacoes.associado_id`
  - `cotacao_id` = `instalacoes.cotacao_id` (quando houver)
  - `modalidade = 'prestador'` (ou o valor que já existir nesse enum; verificar enum `vistoria_modalidade`)
  - `origem = 'prestador'`
  - `status = 'concluida'`
  - `concluida_em = agora`
  - `iniciada_em = link.created_at`
  - dados de endereço copiados de `instalacoes`
  - `dados_parciais.checklist_data = checklist_data` (preserva o que o prestador respondeu)
  - `assinatura_documento_url = assinatura_url` (quando houver)
- **Insert em `vistoria_fotos`** — uma linha por entrada do `fotos_vistoria` jsonb:
  - `vistoria_id = vistoria.id`
  - `tipo = chave do jsonb` (ex.: `chassi`, `motor`, `frente`)
  - `arquivo_url = valor`
  - `visivel_cliente = true`
- **Tolerância a falhas**: se a criação da vistoria/fotos falhar, logar mas **não bloquear** a resposta de sucesso (as fotos continuam salvas no jsonb e o link já está concluído). O backfill abaixo recupera.

### 2. Mapeamento `tipo` → categoria no agrupador

O agrupador `agruparFotosVeiculo` (usado no modal de Veículos) categoriza por `tipo` em `identificacao | exterior | interior | outros`. Precisamos garantir que os `tipo`s gravados pelo prestador (`chassi`, `motor`, `frente`, `traseira`, `lateral_direita`, `lateral_esquerda`, `painel_completo`, `odometro`, `parabrisa`, `mala_aberta`, `banco_*`, `chave`, `chave_roda_macaco`, `capo_aberto_placa`, `bateria`, `estepe`, etc) sejam reconhecidos. Vou ler a função e estender o mapping para que cada chave caia numa categoria correta — sem deixar nada cair só em "outros" silenciosamente.

### 3. Backfill dos casos órfãos existentes

Migration única que:

- Para cada `instalacao_prestador_links` com `status = 'concluida'` e `fotos_vistoria` não-vazio e **sem** vistoria correspondente em `vistorias.instalacao_id`, cria a vistoria + fotos pelo mesmo critério da edge.
- Hoje só há 1 caso (o do usuário, LMX5A90), mas o backfill é seguro mesmo se houver mais.

### 4. (Opcional, pequeno) Indicador no `VeiculoDetalhesModal`

Quando a foto vier de `modalidade='prestador'`, exibir um pequeno selo "Prestador" no card da foto para deixar a origem clara. Sem mudar a query — só usa o campo já retornado por `useFotosVistoriaPorVeiculo`.

## Detalhes técnicos

- **Sem migration de schema**. `vistorias` e `vistoria_fotos` já têm todas as colunas necessárias.
- A migration de backfill é só DML (insert), sem alterar estrutura.
- Confirmar enum `vistoria_modalidade` antes do insert (aceitar `'prestador'` ou usar valor existente como `'remota'` se `'prestador'` não estiver no enum). Se precisar adicionar valor ao enum, vai uma migration mínima `ALTER TYPE … ADD VALUE 'prestador'`.
- A edge mantém o jsonb `fotos_vistoria` no link como antes (auditoria/UI do próprio link público continuam funcionando).
- Sem mudança no Storage; as URLs já vêm de `prestador-fotos` (público). O hook `useFotosVistoriaPorVeiculo` exibe via `arquivo_url` direto, então funciona out-of-the-box.

## O que NÃO vamos fazer

- Não vamos remover/zerar o jsonb `fotos_vistoria` do link — fica como fonte de auditoria e como salvaguarda em caso de falha do passo de materialização.
- Não vamos mexer no fluxo de vistoria do **técnico interno** (que já grava direto em `vistorias` + `vistoria_fotos`). Esse caminho está correto.

## Resultado esperado

- LMX5A90 passa a mostrar as 19 fotos na aba "Fotos/Docs" imediatamente após o backfill rodar.
- Todo link de prestador concluído daqui pra frente cria automaticamente a vistoria canônica e as fotos viram visíveis em Veículos e nos detalhes do associado.
- Reenvios do mesmo link não duplicam dados (idempotência por `instalacao_id`).
