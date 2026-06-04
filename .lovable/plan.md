## Objetivo

Tirar do código os textos e o gatilho de tempo da saudação, manter Regra 2 como está, e cadastrar Regra 3. Receptiva no ar durante a mudança.

## 1. Schema — 3 colunas novas em `ia_habilidades` (nullable, retrocompatível)

Migração simples:

- `mensagem_pos_identificacao text` — texto enviado após capturar CPF ou nome completo.
- `gate_saudacao_horas numeric default 2` — janela em horas para reapresentar a saudação de identificação / suprimir saudação de cerimônia.
- `gate_saudacao_aplicar_identificados boolean default true` — liga/desliga a extensão da trava ao associado já identificado.

Nenhuma coluna é obrigatória; o código lê com fallback aos valores atuais, então a receptiva continua respondendo durante o deploy.

## 2. Conteúdo da habilidade `relacionamento` (UPDATE de dados)

Em `ia_habilidades WHERE slug='relacionamento'`:

- `saudacao_inicial` ← `Olá! Tudo bem? Para iniciarmos o seu atendimento e localizarmos seu cadastro, por gentileza, informe o seu *nome completo* ou o *CPF*. 😁`
- `mensagem_pos_identificacao` ← `Certo, obrigada pelo retorno! Em que podemos te ajudar hoje?`
- `gate_saudacao_horas` ← `2`
- `gate_saudacao_aplicar_identificados` ← `true`

Em `ia_habilidade_conhecimento` (Regra 3, INSERT):

- `categoria='rastreador_acesso'`, `ordem=60`, `ativo=true`
- `pergunta`: "Como o associado pede login/senha/acesso ao rastreador ou ao app de monitoramento?"
- `palavras_chave`: `login, senha, acesso, rastreador, monitoramento, app, aplicativo, monitorar, rastrear, rastrear veículo, app de rastreamento, painel de monitoramento`
- `resposta`: `Para acesso ao rastreador/monitoramento (login, senha ou liberação de aplicativo), a solicitação é feita exclusivamente por e-mail: *rastreador@praticcar.org*. Peça que envie o e-mail informando nome completo, CPF e placa do veículo — a equipe responde por lá.`

Regra 2 (Assistência) fica intocada — já está presente e íntegra.

## 3. Edge `agente-consultor-ia/index.ts` — só ler config e estender trava (sem mexer em roteador/transbordo/envio)

a) Antes do gate de identificação (≈linha 557), carregar a habilidade `relacionamento` uma vez (uma SELECT) e expor `habCfg.saudacao_inicial`, `habCfg.mensagem_pos_identificacao`, `habCfg.gate_saudacao_horas`, `habCfg.gate_saudacao_aplicar_identificados`, todos com fallback aos textos/valores atuais (zero risco de quebrar caso a linha venha incompleta).

b) Substituir as 4 strings hardcoded:
- Linha 831 (CPF capturado) e 854 (nome capturado) → `habCfg.mensagem_pos_identificacao`.
- Linha 922 (saudação canônica) → `habCfg.saudacao_inicial`.
- Continuidade debounced (linha 942) continua hardcoded — não está na regra do usuário.

c) Substituir as constantes `> 2` nas linhas 916–917 por `> habCfg.gate_saudacao_horas`.

d) Bloco NOVO para identificado dentro da janela: quando `jaIdentificado && habCfg.gate_saudacao_aplicar_identificados`, calcular `horasDesdeUltima` e `diaBrtAgora === diaBrtUltima`. Se a mensagem do cliente é saudação pura (regex `^(oi|olá|ola|bom dia|boa tarde|boa noite|e aí|opa|tudo bem|tudo bom)[\s!?.,]*$`) E está dentro da janela (`horasDesdeUltima <= gate_saudacao_horas` E mesmo dia BRT), injetar uma instrução no `systemPrompt` (já existe o bloco de CONTEXTO DE IDENTIFICAÇÃO na linha 1639): "Conversa em andamento hoje — NÃO ressaude de cerimônia, NÃO repita a saudação de identificação. Responda curto e cordial usando o primeiro nome (ex: 'Oi, [PrimeiroNome]! Como posso ajudar?') e, se houver assunto na mensagem, vá direto ao assunto." Fora da janela (primeira mensagem do dia OU >gate_saudacao_horas sem interação), a instrução NÃO é injetada — a LLM volta ao comportamento atual de saudação completa de abertura de turno.

Não é uma resposta canned: o modelo continua gerando o texto. A única lógica nova no código é decidir injetar/não injetar a regra supressora. A regra de tempo em si (`gate_saudacao_horas`) é lida da config.

## Verificações ao final

- `SELECT saudacao_inicial, mensagem_pos_identificacao, gate_saudacao_horas, gate_saudacao_aplicar_identificados FROM ia_habilidades WHERE slug='relacionamento'` → 4 valores conforme item 2.
- `SELECT 1 FROM ia_habilidade_conhecimento WHERE habilidade_slug='relacionamento' AND categoria='rastreador_acesso' AND ativo=true` → presente.
- Regra 2: re-confirmar query da categoria `Assistência` — texto inalterado, com os dois números.
- Caso real: associado identificado mandando "bom dia" às 14h no mesmo dia em que já interagiu às 13h deve receber resposta curta e cordial (sem "Para iniciarmos o seu atendimento..."); mesmo associado mandando "bom dia" na manhã seguinte ou após >2h deve receber saudação normal de abertura.

## Fora do escopo

- Nada na habilidade `vendas`, roteador, transbordo, kill-switch, envio, dedup do histórico, FAQ DESTAQUE.
- Sem tocar na correção de duplicação já implantada.
- Continuidade debounced de 2 min (linha 938/942) e mensagens de tentativa-inválida de CPF (linhas 877/883) ficam como estão — não estão na regra do usuário.
