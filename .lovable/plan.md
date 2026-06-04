## Objetivo

Separar o pós-CPF da habilidade `relacionamento` em três comportamentos distintos, com textos editáveis na config da habilidade e nome do associado preenchido dinamicamente. Busca SGA, roteador, envio, dedup, habilidade `vendas`, tool de situação de veículo e transbordo permanecem intocados.

## Comportamento final

Após o associado mandar o CPF (CPF válido em DV — gate atual em `agente-consultor-ia/index.ts` linhas 829–886):

- **Caso 1 — CPF encontrado no SGA**: confirma de volta usando o nome+ sobrenome  retornado pelo SGA, libera o atendimento (mantém o `update` em `agente_ia_contatos` que já existe hoje, com `nome_confirmado_em`, `sga_associado_encontrado=true`, `liberacao_enviada_em`). Texto vem da config, com placeholder `{nome}` substituído pelo nome do SGA.
- **Caso 2 — CPF não encontrado (1ª tentativa)**: NÃO grava `nome_confirmado_em` nem `liberacao_enviada_em`. Pede para digitar de novo (texto da config). Incrementa contador.
- **Caso 3 — CPF não encontrado (2ª tentativa)**: NÃO libera. Envia mensagem de transbordo (texto da config) e chama o mesmo mecanismo já usado por `solicitar_atendente_humano` (insere pausa em `whatsapp_ia_pausas` com `motivo='transbordo_humano'`, 12h, + notifica Relacionamento — exatamente como a tool faz hoje em `fnName === "solicitar_atendente_humano"`, linha 2060).

Caminho 2 (nome completo digitado, linhas 888–909) e Caminho 3A (números soltos que nem chegam a ser CPF — gate de DV inválido, linhas 911–943) **continuam exatamente como estão**. O contador de "CPF não encontrado no SGA" é separado do contador de "tentativa de CPF inválida" (DV) para não misturar comportamentos.

A frase genérica `mensagem_pos_identificacao` deixa de ser disparada no Caminho 1 (CPF). Ela continua sendo usada no Caminho 2 (nome completo) — esse fluxo não está no escopo da mudança.

## Mudanças

### 1. Schema — `ia_habilidades` (migration)

Três colunas novas, com defaults canônicos para a habilidade `relacionamento` (UPDATE no mesmo migration):

- `mensagem_cpf_encontrado text` — default `'Encontrei você, {nome}! Em que posso te ajudar hoje? 😊'`
- `mensagem_cpf_nao_encontrado_retry text` — default `'Não encontrei esse CPF na nossa base. Pode digitar novamente, por favor? 😉'`
- `mensagem_cpf_nao_encontrado_transbordo text` — default `'Não consegui localizar seu cadastro. Vou te passar para um de nossos atendentes, tudo bem?'`

Em `agente_ia_contatos`, uma coluna nova:

- `cpf_nao_encontrado_tentativas int default 0` — contador específico do Caso 2/3 (separado de `cpf_tentativas_invalidas`, que cobre DV inválido).

### 2. UI — `src/pages/relacionamento/ConfigIA.tsx`

Adicionar 3 `Textarea` na seção de mensagens da habilidade (próximo aos campos `saudacao_inicial` / `mensagem_pos_identificacao` existentes), ligados ao mesmo `form` e ao mesmo `useUpsertIAHabilidade`. Texto de ajuda no campo "CPF encontrado" deixando claro que `{nome}` é substituído pelo nome do SGA.

### 3. Loader — `agente-consultor-ia/index.ts` (≈ linhas 583–610)

Adicionar os 3 campos ao tipo `habCfg`, ao `select` e ao mapeamento, com fallbacks idênticos aos defaults do migration.

### 4. Edge `agente-consultor-ia` — Caminho 1 (linhas 829–886)

Substituir o bloco final do Caminho 1 (a partir de `await enviarTexto(habCfg.mensagem_pos_identificacao);`):

- Se `encontrado === true`:
  - Mantém o `update` atual (com `nome_confirmado_em`, `liberacao_enviada_em`, `sga_associado_encontrado=true`, `cpf_tentativas_invalidas=0`, `cpf_nao_encontrado_tentativas=0`).
  - Renderiza `mensagem_cpf_encontrado` substituindo `{nome}` pelo `nomeSga` (fallback: primeiro nome do cadastro local, ou texto sem placeholder se nada).
  - Envia, retorna `gate: "identificado_cpf"`.
- Se `encontrado === false`:
  - Lê `cpf_nao_encontrado_tentativas` atual; incrementa.
  - **NÃO** grava `nome_confirmado_em` nem `liberacao_enviada_em` (importante para não liberar o gate). Grava só `cpf` capturado, `sga_associado_encontrado=false`, e o contador novo.
  - Se contador `>= 2`: envia `mensagem_cpf_nao_encontrado_transbordo` + dispara o mesmo bloco de transbordo da tool `solicitar_atendente_humano` (insert em `whatsapp_ia_pausas` motivo `transbordo_humano` 12h + notificação Relacionamento + atualização de `agente_ia_contatos.status='atendimento_humano'`). Reaproveita o código já existente — extrair em helper interno ou inline a mesma chamada. Reseta contador. Retorna `gate: "cpf_nao_encontrado_transbordo"`.
  - Senão: envia `mensagem_cpf_nao_encontrado_retry`. Retorna `gate: "cpf_nao_encontrado_retry"`.

Sem reset de `cpf_nao_encontrado_tentativas` no Caminho 2/3A (são contadores independentes); reset acontece só quando CPF é finalmente encontrado (Caso 1 sucesso) ou quando o transbordo dispara.

### 5. Sem mudanças

- `sga-buscar-associado-completo`: intocado.
- Tool `solicitar_atendente_humano`: intocada (o gate só reusa o mesmo padrão de inserção em `whatsapp_ia_pausas` + notificação).
- Roteador, dedup, envio, vendas, `consultar_situacao_veiculo`, validador de saída, gate de saudação, Caminho 2 (nome), Caminho 3A (DV inválido), Caminho 3B (texto livre): intocados.
- `mensagem_pos_identificacao` continua existindo e sendo usada no Caminho 2 (nome completo). Só perde o uso no Caminho 1.

## Rollback

Tudo num único commit. Rollback = `git revert` do commit. A migration adiciona colunas com default — reverter o código volta ao comportamento antigo (que ignora as novas colunas) sem deixar a receptiva muda. As colunas extras podem ficar no banco sem efeito.

## Risco residual

Durante a janela entre deploy do código e deploy do migration, o `select` pode falhar se as colunas ainda não existirem. Mitigação: deploy do migration **antes** do deploy da edge (ou usar try/catch no select por enquanto). Vou ordenar migration → edge no build.

## Checklist de confirmação ao final

- CPF encontrado → confirma com nome completo (texto da config + `{nome}` dinâmico) e libera.
- CPF não encontrado → 1ª vez pede reenvio; 2ª vez transborda via mecanismo existente.
- Frase genérica `mensagem_pos_identificacao` não é mais resposta de identificação por CPF.
- Receptiva no ar durante a mudança.