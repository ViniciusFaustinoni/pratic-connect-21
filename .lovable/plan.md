## Objetivo

Eliminar todos os caminhos paralelos do `whatsapp-webhook` que (a) identificam o contato pelo telefone, (b) cumprimentam pelo nome antes da identificação, (c) duplicam o gate de identificação com texto fixo no código, ou (d) rodam um pipeline IA paralelo ao `agente-consultor-ia`. Toda mensagem com IA habilitada passa a percorrer um único caminho canônico: `whatsapp-webhook` (router fino) → `agente-consultor-ia` (gate único, saudação da config, janela existente).

O agente já tem o gate canônico (`agente-consultor-ia/index.ts:780–942`) lendo `saudacao_inicial`, `mensagem_pos_identificacao`, `gate_saudacao_horas` e `gate_saudacao_aplicar_identificados` de `ia_habilidades` (slug `relacionamento`) e já trata "uma vez por sessão" via `jaIdentificado` + janela + reconfirmação leve. Não muda.

## Rollback

- Tudo em **1 commit** que toca apenas `supabase/functions/whatsapp-webhook/index.ts`. Reverter é clicar no botão de revert da mensagem da AI no chat (ou usar a aba History) — restaura o arquivo inteiro ao estado anterior. Sem migração de schema, sem dado mutado, sem dependência cruzada.
- Receptiva nunca fica muda no meio: o deploy do edge é atômico — ou está a versão nova ou a antiga. Não há janela em que metade do gate está apagado e a outra metade ainda viva.
- Em caso de problema, revert volta o pipeline paralelo, os gates fixos e a desambiguação por telefone imediatamente. A habilidade `relacionamento` em `ia_habilidades` segue inalterada, então tanto o caminho antigo quanto o novo voltam a funcionar.

## Mapeamento bloco-removido → equivalente no agente

| Bloco removido (webhook) | O que fazia | Cobertura equivalente |
|---|---|---|
| **(1) Desambiguação por telefone (3677–3754)** | Buscava `candidatosAssociados` por whatsapp/telefone, escolhia 1, fazia fallback por CPF cacheado | Roteador do agente usa o mesmo `agente_ia_contatos` (lookup por telefone) só para escolher habilidade (associado → relacionamento, lead → vendas). Identidade do **usuário** só vem do gate por CPF/nome. |
| **(2) Gate CPF hardcoded (3756–3833)** | String fixa "informe o seu CPF" + parse CPF + "Encontrei você, X" | `agente-consultor-ia` linhas 780–942: gate canônico com `habCfg.saudacao_inicial`, validação CPF (DV) ou nome completo, lookup SGA via `sga-buscar-associado-completo`, persistência em `agente_ia_contatos`, mensagem `habCfg.mensagem_pos_identificacao`. |
| **(3a) Suspenso/em_analise/pendente (3845–3857)** | Resposta canned por status com nome do associado | A habilidade `relacionamento` (persona + base de conhecimento) responde sobre status. **Risco identificado:** hoje a base de conhecimento não tem item explícito para "cadastro suspenso/em análise". Mitigação: depois do CPF, o agente já recebe `sga_associado_status` em `agente_ia_contatos` e a persona responde via LLM. Se ficar genérico demais, adiciona-se item de conhecimento depois (não bloqueante — a IA não fica muda). |
| **(3b) Cancelado → criar lead (3859–3895)** | Inseria lead de recontratação + delegava ao agente | **Preservar o `INSERT` em `leads`** no webhook como bookkeeping silencioso (sem mensagem ao cliente) antes da delegação. O agente cuida da conversa via habilidade `vendas` (lead). |
| **(3c) Status desconhecido (3899–3902)** | Resposta canned "entre em contato com a central" | Substituída pela persona do agente após identificação. |
| **(4) CPF de número desconhecido (3989–4101)** | Parse 11 dígitos, lookup SGA, "Encontrei você", criação de lead, "CPF não encontrado" | Idêntico ao (2). O gate do agente (CAMINHO 1, linhas 830–885) já consulta SGA, persiste vínculo e responde. Criação de lead bookkeeping fica em 4108–4139 (preservada). |
| **(5) Pipeline IA paralelo associado ativo (4180–4292)** | `getAssociadoContext` + `callAI(buildWhatsappSystemPrompt + identidadeCtx)` + loop de tool calls próprio | `agente-consultor-ia` é o agente: mesmo modelo via `aiGatewayFetch`, contexto SGA via tools (`consultar_situacao_veiculo`, tools de boleto), histórico próprio em `agente_ia_contatos`, persona da habilidade relacionamento, transbordo via `solicitar_atendente_humano`. As tools de 2ª via de boleto e situação financeira que o pipeline 5 usava via `executeTool` já existem no agente. |

Nenhum caso atendido hoje fica órfão. O único downgrade UX possível é o item (3a): em vez de uma frase canned por status, a IA conversa via persona. Se virar incômodo, adiciona-se item de conhecimento depois — sem reabrir esse refactor.

## Execução em duas levas

As duas levas são separáveis com segurança. Razão: removendo o lookup de associado por telefone (leva 1), a variável `associado` fica sempre `null` no caminho IA, então o pipeline paralelo (linhas 4180+) vira código morto inofensivo — o fluxo cai sempre em "número desconhecido → delegar ao agente". A leva 2 só apaga o que já está dormindo.

### Leva 1 — gates de identificação (itens 1–4)

Em `whatsapp-webhook/index.ts`, dentro do bloco "FLUXO PADRÃO: ASSOCIADO OU LEAD" (3650–4177):

- Remover os lookups de associado por telefone (3677–3754).
- Remover o gate CPF canônico paralelo (3756–3833).
- Remover as respostas canned por status (3836–3902), preservando apenas o `INSERT` silencioso em `leads` para o caso cancelado (sem `sendWhatsAppMessage`).
- Remover o gate "número desconhecido → identificar por CPF" (3989–4101), preservando `INSERT` silencioso em `leads` e `saveWhatsAppLog`.
- Manter o pipeline 5 (4180–4292) por enquanto: ele vira inalcançável porque `associado` é sempre `null`.
- Resultado: fluxo IA do webhook = kill-switch → `saveWhatsAppLog` → criar lead se necessário → delegar ao `agente-consultor-ia` → `return ok`.

**Validar leva 1** (cenários 1–7 abaixo) antes de seguir.

### Leva 2 — remover o pipeline paralelo (item 5)

Já validado morto. Apagar 4180–4292 e qualquer helper que vire órfão (`getAssociadoContext`, `buildWhatsappSystemPrompt`, `executeTool`, `callAI` se não usados em outro lugar — confirmar via `rg` antes de remover cada um). **Validar cenário 8** abaixo.

Se a leva 2 sair torta, revert do commit da leva 2 sozinho não restaura comportamento (pipeline 5 estava morto desde a leva 1 — voltou a ser código morto). Se algo der errado no comportamento de associado ativo após a leva 1, é porque o agente não cobre algo que precisamos identificar e corrigir no agente, não voltar o pipeline paralelo.

## Verificação ao final de cada leva

**Após leva 1:**

1. Marcos (CPF 14194896742) manda "oi" → resposta vem da `saudacao_inicial` configurada ("…informe o seu *nome completo* ou *CPF*. 😁"), não da string fixa antiga.
2. Marcos identificado dentro da janela (`gate_saudacao_horas`=2h, mesmo dia BRT) manda outra mensagem → agente NÃO repede CPF/nome, NÃO ressauda.
3. `rg -n "informe o seu CPF" supabase/functions/whatsapp-webhook/index.ts` → vazio.
4. `rg -n "Encontrei você" supabase/functions/whatsapp-webhook/index.ts` → vazio.
5. Telefone novo desconhecido manda "oi" → gate do agente dispara com saudação da config.
6. Telefone com múltiplos associados (caso MARCOS x LUIZ) manda "oi" → mesmo caminho único; agente pede CPF/nome; só após CPF a IA decide quem é.
7. Ex-associado cancelado manda mensagem → lead de recontratação é criado em `leads` (verificar via `psql`), nenhuma resposta canned do webhook é enviada, agente responde via habilidade vendas.

**Após leva 2 — cenário do pipeline paralelo:**

8. **Associado ativo identificado (CPF cacheado em `agente_ia_contatos`) pede 2ª via de boleto** ("preciso da segunda via do boleto da placa XYZ1234"): agente responde com boleto via tool SGA, equivalente ao que o `executeTool` do pipeline 5 fazia. Comparar resposta com o histórico de uma mensagem similar atendida pelo pipeline antigo (em `whatsapp_mensagens`) — informação retornada precisa ser igual ou superior (mesma linha digitável, mesmo valor, mesmo vencimento).

## Fora do escopo

- `agente-consultor-ia/index.ts`: nenhuma alteração.
- Habilidade `vendas`, kill-switch (`whatsapp_instancias.ia_habilitada`), envio (`whatsapp-send-text`), dedup de saída, FAQ DESTAQUE, contexto agendamento pendente, tool `consultar_situacao_veiculo`, transbordo, roteador (`lib/roteador.ts`): intactos.
- Schema do banco: nenhuma migração. `ia_habilidades.saudacao_inicial` já é a fonte canônica.

## Confirmação a entregar ao final

- Telefone não é mais usado para identificar o usuário em nenhum ponto user-facing.
- Caminho de desambiguação por telefone foi eliminado do webhook.
- Saudação de identificação vem sempre de `ia_habilidades.relacionamento.saudacao_inicial`, nunca de string fixa no código.
- Identificação é pedida uma vez por sessão (janela `gate_saudacao_horas`) e não se repete no meio da conversa já identificada.
- Pipeline IA paralelo do webhook foi removido sem perda de comportamento — validado contra cenário 8.
