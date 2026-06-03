## Diagnóstico

Auditei `supabase/functions/agente-consultor-ia/index.ts` + `_shared/ai-client.ts` cruzando com as telas `Configurações › Agente Consultor IA` e `Relacionamento › Maya IA`. Hoje **parte das configurações é silenciosamente ignorada**:

| Configuração (UI) | Tabela | Hoje | Problema |
|---|---|---|---|
| Kill switch global | `agente_ia_config.agente_ativo` | ✅ aplicado | — |
| `nome_agente` | `agente_ia_config` | ✅ em todos os branches | — |
| `apresentacao_inicial` + `instrucoes_comportamento` | `agente_ia_config` | ⚠️ aplicado **só no branch LEAD** (l.1020-1033) | Branches Diretor (l.811) e Associado (l.878) **ignoram** a aba "Comportamento" |
| `mensagem_fora_horario` + `responder_fora_horario` | `agente_ia_config` | ❌ lido mas **nunca usado** (l.616-617) | Mensagem fora de horário não dispara |
| Maya — `persona / regras_absolutas / tom_voz / saudacao_inicial` | `maya_ia_comportamento` | ✅ override em todas as audiências (l.1313-1339) | — |
| Maya — FAQ (destaque + base) | `maya_ia_faq` | ✅ | — |
| Modelo global (`provider/model`) | `ai_model_config` | ⚠️ respeitado quando provider≠Lovable; **ignorado quando provider=Lovable** porque `aiGatewayFetch` prioriza `parsed.model` (l.464) e o agente sempre passa `google/gemini-3-flash-preview` hardcoded (l.1379) | Trocar o modelo na UI dentro do Lovable Gateway **não tem efeito** na Maya |

## Correções

### 1. Aplicar Comportamento (apresentação + instruções) em TODOS os branches
Em `supabase/functions/agente-consultor-ia/index.ts`:
- Branch **Diretor** (l.811-855): anexar bloco `## INSTRUÇÕES DE COMPORTAMENTO (Config)\n${instrucoes}` quando `instrucoes` não vazio, e usar `apresentacao` como override da saudação inicial quando preenchida.
- Branch **Associado** (l.878-960): mesmo tratamento.
- Manter precedência: override editorial Maya (l.1327) continua **acima** dessas regras (já é “PREVALECE SOBRE QUALQUER REGRA ACIMA”).

### 2. Aplicar `mensagem_fora_horario` / `responder_fora_horario`
Logo após o kill switch (l.611), checar janela comercial (timezone America/Sao_Paulo, seg–sex 08–18 — manter o critério que já existe em outros pontos, ou expor `horario_inicio/horario_fim` se as colunas existirem). Se fora do horário:
- Se `responder_fora_horario === 'false'` e `mensagem_fora_horario` não vazio → `enviarTexto(mensagem_fora_horario)` (com debounce de 30 min em `agente_ia_contatos.ultima_msg_fora_horario_em`) e `return`.
- Se `responder_fora_horario === 'true'` → segue fluxo normal.
- Migration: adicionar coluna `ultima_msg_fora_horario_em timestamptz` em `agente_ia_contatos`.

### 3. Respeitar o modelo global escolhido na UI
Em `supabase/functions/_shared/ai-client.ts`, função `aiGatewayFetch` (l.460-467): remover o atalho que permite ao caller sobrepor o modelo quando provider global é Lovable. Passar a usar **sempre** `cfg.model`, ignorando `parsed.model`. Isto faz com que o seletor de modelo na tela Configurações tenha efeito real na Maya/Vinicius (e em todas as edges que já usam `aiGatewayFetch`).

Como rede de segurança, manter um override explícito via opção (não pelo body) — quem realmente precisar fixar o modelo passa `override.model` em `callAI` (uso interno raro, ex.: tarefas com formato JSON estrito que exigem modelo específico).

### 4. Observabilidade
- Log estruturado no início do handler: `[maya_config] {model, provider, agente_ativo, has_instrucoes, has_apresentacao, fora_horario}` — facilita validar em produção que a configuração da UI chegou na requisição.

## Não muda
- Lógica de gate de CPF, fallback de vácuo, transbordo humano, FAQ destaque, dedupe `agente_ia_locks`, `processar-fila-ia`.
- ChatPanel (frontend) — o atendente humano continua enviando texto livre via `whatsapp-send-text` sem passar pela IA. Configurações da Maya só afetam o turno da IA.

## Arquivos
- `supabase/functions/agente-consultor-ia/index.ts` (branches Diretor/Associado + bloco fora_horario + log)
- `supabase/functions/_shared/ai-client.ts` (remover atalho de modelo em `aiGatewayFetch`)
- 1 migration: `ultima_msg_fora_horario_em` em `agente_ia_contatos`

## Resultado esperado
Trocar modelo, editar apresentação/instruções, ativar mensagem fora de horário, editar persona/FAQ da Maya na UI → todas refletidas na próxima mensagem que a IA responder, sem deploy.