## Objetivo

Transformar o agente único parametrizado por audiência em **N habilidades independentes**, cada uma uma caixa fechada (regras, conhecimento, exemplos, tom, ferramentas, liga/desliga). Hoje começamos com duas: `vendas` (Vinicius) e `relacionamento` (Maya). O modelo precisa permitir adicionar uma 3ª/4ª no futuro sem refazer estrutura.

Princípio canônico: **roteamento por habilidade, não por audiência**. Quem é o cliente (lead/associado/diretor) vira só um *filtro de elegibilidade* dentro de cada habilidade — não a chave de seleção do prompt.

---

## 1. Modelo de dados (nova base)

### Tabela `ia_habilidades` (nova, canônica)
A "caixa" de cada habilidade.

- `slug` (PK textual: `vendas`, `relacionamento`)
- `nome_exibicao`, `descricao`
- `ativa` (bool) — **o liga/desliga independente**
- `nome_agente` (Vinicius, Maya, …)
- `persona`, `regras_absolutas`, `tom_voz`, `saudacao_inicial`
- `audiencias_elegiveis` (text[]: quem essa habilidade aceita atender — `['lead']` para vendas, `['associado','diretor']` para relacionamento)
- `ferramentas_habilitadas` (text[]: nomes das tools que essa habilidade pode chamar)
- `prioridade_roteamento` (int) — desempate quando 2 habilidades aceitam a mesma audiência
- `horario_atendimento` (jsonb: dias/horários, ou null=24/7)
- `mensagem_fora_horario`

### Tabela `ia_habilidade_conhecimento` (nova, substitui FAQ compartilhada)
FAQ/conhecimento **por habilidade**, não por audiência.

- `habilidade_slug` (FK → `ia_habilidades.slug`)
- `categoria`, `pergunta`, `resposta`, `palavras_chave`, `ordem`, `ativo`
- ❌ Sem coluna `audiencias` (a audiência já é dada pela habilidade)

### Tabela `ia_habilidade_exemplos` (nova)
Exemplos de resposta canônicos por habilidade (few-shot dedicado).

- `habilidade_slug`, `titulo`, `entrada_usuario`, `resposta_ideal`, `notas`, `ordem`

### `ai_model_config` (mantém global)
Provedor + modelo continua global — não faz sentido cada habilidade ter modelo diferente hoje.

### Migração dos dados atuais
- `maya_ia_comportamento` (audiência=`lead`) → `ia_habilidades` slug=`vendas`
- `maya_ia_comportamento` (audiência=`associado`/`diretor`) → `ia_habilidades` slug=`relacionamento` (com `audiencias_elegiveis=['associado','diretor']`)
- `maya_ia_faq` → `ia_habilidade_conhecimento`, com regra: FAQ marcada só `['lead']` vai pra `vendas`; só `['associado']`/`['diretor']` vai pra `relacionamento`; marcada pra **ambos** é **duplicada** e o operador decide depois quais ficam (relatório de duplicatas)
- `agente_ia_config` (global) → **descontinuado**; conteúdo migrado pra `persona`/`regras_absolutas` da habilidade correta (decisão manual via relatório, sem mover cego)

### Tabelas mantidas
`agente_ia_contatos`, `agente_ia_locks`, `whatsapp_ia_pausas`, `whatsapp_fila_ia`, `ai_model_config`, `whatsapp_instancias` (toggle global continua existindo como master switch).

### Tabelas a depreciar (não dropar agora — manter por 1 release)
`maya_ia_comportamento`, `maya_ia_faq`, `agente_ia_config`. Marcar como deprecated em comentário SQL e na UI; remover em release seguinte após validação.

---

## 2. Roteamento (entrada da mensagem)

Novo arquivo `supabase/functions/agente-consultor-ia/lib/roteador.ts`:

```text
mensagem entra
  ↓
resolver audiência do contato (lead | associado | diretor)
  ↓
SELECT * FROM ia_habilidades
  WHERE ativa = true
    AND audiencia ∈ audiencias_elegiveis
  ORDER BY prioridade_roteamento
  ↓
0 habilidades ativas elegíveis → fallback canônico ("nosso atendimento por IA está pausado, em instantes um humano te responde") + abre transbordo
1 habilidade → usa ela
2+ → primeira por prioridade (futuro: classificador de intenção)
```

**Consequência direta:**
- Desligar `vendas` → leads recebem mensagem de pausa + transbordo (não cai no Maya, não cai em prompt vazio).
- Desligar `relacionamento` → associados recebem pausa + transbordo.
- Desligar os dois → equivale ao toggle global atual (mas agora granular).

---

## 3. Edge function `agente-consultor-ia` refatorada

Hoje: ~2910 linhas com `if (isAssociado) {…} else {…}` enroscado.

Reorg em módulos (mesma pasta, sem subpastas extras na raiz):
- `index.ts` — entrada HTTP, dedup (`agente_ia_locks`), invoca roteador, chama executor
- `lib/roteador.ts` — resolve habilidade ativa
- `lib/executor.ts` — monta prompt a partir da habilidade selecionada (persona + regras + tom + saudação + conhecimento + exemplos + ferramentas habilitadas), injeta `ai_model_config`, chama LLM
- `lib/gates.ts` — gates canônicos universais (saudação+identificação, fora-horário, vácuo, validador de saída, fallback de transbordo)
- `lib/tools/` — uma tool por arquivo (`consultar_boletos.ts`, `consultar_placa.ts`, `calcular_cotacao.ts`, `solicitar_atendente_humano.ts`, etc.); executor só passa adiante as listadas em `ferramentas_habilitadas`

Critério de aceite estrutural: nenhum `if (isAssociado)` sobrevive. Toda diferença vira dado em `ia_habilidades`.

---

## 4. UI de configuração

Nova área: **Configurações → Inteligência Artificial → Habilidades** (substitui as telas atuais espalhadas).

Lista de habilidades como cards, cada card com:
- Toggle **Ativa/Inativa** (o liga/desliga independente — pedido principal)
- Badges: audiências elegíveis, ferramentas, horário
- Atalho pra editar persona/regras/tom/saudação
- Aba "Conhecimento" (FAQ daquela habilidade)
- Aba "Exemplos" (few-shot)
- Aba "Ferramentas" (checkboxes do catálogo de tools)
- Aba "Horário de atendimento"
- Botão "+ Nova habilidade" (descoberto, não bloqueante)

A página atual `IntegracaoWhatsApp.tsx` aba "IA & Respostas" passa a linkar pra essa nova tela. `AIModelConfigCard` continua global em **IA → Configuração** (modelo).

Toggle global `whatsapp_instancias.ia_habilitada` é mantido como **master switch** (desliga tudo de uma vez) e fica visível com aviso claro de que individual está nas habilidades.

---

## 5. Migração de conteúdo — fluxo seguro

Não migrar cego. Roteiro:

1. Rodar migration que **cria** as novas tabelas (sem dropar nada).
2. Script de migração popular `ia_habilidades` com 2 linhas (`vendas`, `relacionamento`) usando os textos atuais de `maya_ia_comportamento`.
3. Script popular `ia_habilidade_conhecimento` a partir de `maya_ia_faq` com a regra de mapeamento acima; FAQ marcada pra múltiplas audiências cruzadas é **duplicada com tag `revisar=true`**.
4. Gerar relatório (CSV em `/mnt/documents/`) com:
   - FAQs duplicadas (operador decide quais ficam em cada caixa)
   - Itens de `agente_ia_config` que precisam virar persona/regra (decisão manual)
5. Sistema continua lendo das **tabelas antigas** até o flag `IA_HABILIDADES_V2=true` ser ligado. Cutover controlado.
6. Após 1 release estável, dropar tabelas antigas em migration separada.

---

## 6. Observabilidade

- Log estruturado por requisição: `[habilidade_selecionada] slug=vendas motivo=audiencia_unica` ou `slug=null motivo=nenhuma_ativa`
- Coluna `agente_ia_contatos.ultima_habilidade_atendeu` (texto) — auditoria de qual caixa respondeu
- Métrica simples na tela: contagem de mensagens por habilidade nos últimos 7 dias

---

## 7. Memórias atualizadas

- Nova: `mem://logic/ia/habilidades-canonicas` — modelo de habilidades independentes, regra de roteamento, liga/desliga por habilidade
- Atualizar: `mem://logic/operations/maya-saudacao-e-identificacao-canonica`, `mem://logic/operations/transbordo-relacionamento-canonico`, `mem://logic/operations/maya-nunca-deixa-vacuo`, `mem://logic/operations/maya-config-aplicada-em-todas-audiencias` — todas passam a referenciar `ia_habilidades` em vez de `maya_ia_*`
- Depreciar (com nota): qualquer memória que ainda mande editar `agente_ia_config` global ou `maya_ia_comportamento` por audiência

---

## 8. Fora de escopo desta entrega

- Classificador de intenção (decidir entre 2 habilidades pelo conteúdo da mensagem) — fica pra quando existir 3ª habilidade
- Versionamento/A-B de prompts por habilidade
- Tradução das tabelas legadas para inglês
- Mudanças em `whatsapp-webhook` além de propagar o `nome_contato` (já no plano anterior)

---

## 9. Critérios de aceite

1. Desligar `vendas` na UI → próximo lead recebe mensagem de pausa + transbordo; nenhum associado é afetado
2. Desligar `relacionamento` na UI → próximo associado recebe pausa + transbordo; nenhum lead é afetado
3. FAQ criada em `relacionamento` **não aparece** no prompt de `vendas` (sem vazamento)
4. Tool `consultar_boletos_associado` não fica disponível pra `vendas` (catálogo isolado)
5. Logs mostram `[habilidade_selecionada]` em 100% das execuções
6. Nenhum `if (isAssociado)` no código novo de prompt/roteamento

---

## Arquivos tocados (resumo)

**Migrations** — criar `ia_habilidades`, `ia_habilidade_conhecimento`, `ia_habilidade_exemplos` + grants + RLS + script de seed/migração de dados.

**Edge functions** — refatorar `supabase/functions/agente-consultor-ia/index.ts` em módulos (`lib/roteador.ts`, `lib/executor.ts`, `lib/gates.ts`, `lib/tools/*`); ajustar `whatsapp-webhook` só pra propagar `nome_contato`.

**Frontend** — nova página `src/pages/configuracoes/IAHabilidades.tsx` + componentes `src/components/integracoes/ia-habilidades/*` (card, editor de persona, editor de FAQ, editor de exemplos, seletor de ferramentas, editor de horário); hook `src/hooks/useIAHabilidades.ts` substitui `useMayaIA.ts` (mantém o antigo até cutover).

**Memórias** — atualizar as 4 memórias listadas + criar `mem://logic/ia/habilidades-canonicas`.
