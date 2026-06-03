## Diagnóstico

O caso da THAIS (telefone WhatsApp `5521985791044`) revela duas falhas reais:

1. **Webhook não usa o cache de CPF para identificar associado.**
   - `associados.telefone` = `21975408711` (cadastro antigo).
   - WhatsApp dela = `5521985791044`.
   - Em `whatsapp-webhook` (linhas ~3678-3720), a busca de associado é só por telefone. Sem match, ela cai como "não associada" → branch de **lead** → delega para `agente-consultor-ia` com `nome_contato` de lead.
   - Resultado: contexto enviado ao agente é o de **lead**, mesmo a tabela `agente_ia_contatos` tendo `cpf=15230046732` + `sga_associado_encontrado=true` + `nome=THAIS GURUCEAGA DOS SANTOS` desde 15:12 de hoje.

2. **`agente-consultor-ia` produziu prompt de Vinicius mesmo com cache populado.**
   - O cache em `agente_ia_contatos` está completo (`cpf` + `sga_associado_encontrado=true` + `nome`).
   - Mesmo assim, a resposta às 18:30 foi a saudação de venda do Vinicius ("Sou o Vinicius… adesão TOTALMENTE GRATUITA… informe a placa"). Isso só acontece se `isAssociado=false` no momento de escolher o prompt (branch da linha 1025 caiu no `else` final, que é o do Vinicius).
   - O bloco de cache (linha 800) deveria ter detectado, mas o output empírico mostra que **não detectou** — provavelmente a versão atualmente servida da função não é a que está no repositório (deploy anterior reportou sucesso mas a resposta em produção indica contrário), ou o cache cai numa borda silenciosa.

Há também um detalhe colateral: as duas mensagens "Quero solicitar um reboque" (12:38) e "Gostaria de solicitar um reboque" (13:07) ficaram **sem resposta**. Não é vácuo do agente — `whatsapp_ia_pausas` tinha pausa ativa até **2026-06-03 16:27:19** (motivo `encerrado_humano`). Comportamento correto da pausa; nada a fazer aí.

## O que vai ser feito

### 1. `whatsapp-webhook` — identificar associado por cache de CPF antes de cair em "lead"

Imediatamente após o lookup atual por telefone falhar (linha ~3680, quando `associado` fica `null`), antes de entrar no fluxo de lead, consultar `agente_ia_contatos` pelo telefone:

- Se `contato.cpf` + `sga_associado_encontrado=true` + `contato.nome` estiverem presentes, fazer **lookup canônico em `associados` por CPF** (`.eq('cpf', contato.cpf)`).
- Se achar associado real → tratar como associado normalmente (mesmo branch dos statuses `ativo`/`em_analise`/`cancelado`). Telefone divergente passa a ser **irrelevante** quando o vínculo já foi confirmado por CPF em rodada anterior.
- Log: `[whatsapp-webhook] Associado por CPF cacheado (telefone divergente): nome (status)`.

Isso fecha o vazamento estrutural: nenhum associado já identificado por CPF cai mais no branch de lead/Vinicius só porque o WhatsApp dele difere do telefone cadastrado em `associados`.

### 2. `agente-consultor-ia` — endurecer detecção por cache e re-deployar

- Manter o bloco atual de cache (linha 800), mas elevar o log: imprimir `[isAssociado_resolution] origem=cache|telefone|sga_override|none` **antes** de escolher o prompt (linha 1025), e logar `[prompt_branch] diretor|associado|lead` no instante exato da seleção. Isso elimina ambiguidade no diagnóstico futuro.
- Garantir que o caller (webhook) propague o nome do associado quando vier da resolução via CPF cache (passo 1) — ajuste no payload `nome_contato`.
- **Re-deployar** `agente-consultor-ia` explicitamente para garantir que a versão com cache (linhas 697-805) está em produção.

### 3. Sem mudanças em

- Prompts de Maya, Vinicius e diretor.
- FAQ, config IA, gates de fora-horário, gate de saudação canônica.
- `processar-fila-ia`, `whatsapp-send-text`, `solicitar_atendente_humano`, `consultar_boletos_associado`.
- `whatsapp_ia_pausas` (comportamento da pausa está correto).

### 4. Observabilidade / memória

- Estender `mem://logic/operations/maya-saudacao-e-identificacao-canonica` com o item "Webhook resolve associado por CPF cacheado quando telefone diverge" (caso THAIS / 5521985791044, 03/06).
- Não criar migração (não há schema novo — `agente_ia_contatos.cpf/sga_associado_encontrado/nome` já existem).

## Arquivos tocados

- `supabase/functions/whatsapp-webhook/index.ts` — bloco novo de resolução por CPF cacheado antes do branch de lead, propagação do nome no `nome_contato`.
- `supabase/functions/agente-consultor-ia/index.ts` — logs de resolução de audiência e branch de prompt; re-deploy.
- `mem://logic/operations/maya-saudacao-e-identificacao-canonica` — update.
- `mem://index.md` — sem novas memórias (linha core existente já cobre).

## Validação

1. Re-deploy de `agente-consultor-ia` e `whatsapp-webhook`.
2. Curl direto em `agente-consultor-ia` com `telefone=5521985791044, texto="Boa noite"` → esperado: log `[isAssociado_resolution] origem=cache` + log `[prompt_branch] associado` + resposta Maya ("Olá, THAIS! 👋 Sou Maya… Como posso te ajudar hoje?").
3. Curl em `whatsapp-webhook` simulando payload Evolution com o mesmo telefone → esperado: log `Associado por CPF cacheado (telefone divergente): THAIS` + delegação ao agente com `nome_contato=THAIS GURUCEAGA DOS SANTOS`.
4. Conferir em `whatsapp_mensagens` que a próxima saída para o telefone começa por "Olá, THAIS! 👋 Sou Maya" e não menciona "Vinicius" nem "TOTALMENTE GRATUITA".