## Diagnóstico

Caso real: THAIS (associada ATIVA, CPF `15230046732`) mandou "Boa noite" às 18:30 BRT pedindo reboque. O bot respondeu como **Vinicius oferecendo cotação gratuita** — exatamente o oposto.

### Bugs estruturais

**B1. Detecção de associado depende de telefone — ignora CPF já validado no contato**
`agente_ia_contatos` da THAIS tem `cpf`, `nome`, `sga_associado_encontrado=true`. Mas o WhatsApp dela (`5521985791044`) diverge do `associados.telefone/whatsapp` (`21975408711`). Em `agente-consultor-ia/index.ts` linhas 707–780, a busca por telefone falha → cai em LEAD. O override `sgaAssociadoOverride` (linhas 774–779) só roda na mensagem em que o CPF é informado pela primeira vez.

**B2. Gate fora-horário é binário — não distingue Vinicius (vende) × Maya (atende)**
Hoje (linhas 619–650): `responder_fora_horario=false` → encerra; `=true` → segue tudo (Vinicius vende às 22h). Não existe o modo correto: **Maya/Relacionamento atende 24/7; Vinicius/vendas respeita horário.**

### Regras novas (Relacionamento › Chat)

**R1. Saudação obrigatória bloqueante**
Primeira mensagem do dia OU >2h sem interagir → ignora o conteúdo da mensagem e responde:

> "Olá! Tudo bem? Para iniciarmos o seu atendimento e localizarmos seu cadastro, por gentileza, informe o seu nome completo ou o CPF. 😁"

**R2. Validações canônicas de identificação (as duas únicas aceitas)**

- **CPF** — 11 dígitos válidos por DV (algoritmo padrão Receita); consulta SGA para confirmar.
- **Nome completo** — ≥2 palavras alfabéticas, total ≥10 caracteres, sem dígitos, sem caracteres especiais relevantes.

Nada além disso libera o fluxo. Texto solto, saudações, dúvidas pré-identificação → repete a mensagem de identificação (debounce 2 min em `ultima_msg_continuidade_em` já existente).

**R3. Liberação**
Quando uma das duas validações passar:

> "Certo, obrigada pelo retorno! Em que podemos te ajudar hoje?"

A partir daí o fluxo normal toma conta (Maya/Associado se SGA encontrou; Maya/Lead se só temos nome). Saudação não repete enquanto a janela `<2h` E `mesmo dia BRT` estiver válida.

### Compatibilidade com regras vigentes

- "Maya nunca deixa vácuo" continua valendo: o próprio gate de saudação/identificação responde — nunca silencia.
- Hierarquia canônica: **Saudação obrigatória → Validação (Nome completo OU CPF) → Detecção de audiência → (Maya|Vinicius) → Fluxo normal.**

---

## Plano

### Correção 1 — Audiência por CPF cacheado (resolve B1)

Em `supabase/functions/agente-consultor-ia/index.ts`, bloco 4B (linhas 707–780): **antes** da busca em `associados` por telefone, se `contato.cpf` + `contato.sga_associado_encontrado=true` + `contato.nome` existem, marca `isAssociado=true` direto. Status vem de coluna nova `sga_associado_status` (fallback `'ativo'`). Mantém busca por telefone como fallback. Mantém override SGA da rodada como rede de segurança.

### Correção 2 — Gate fora-horário ciente da audiência (resolve B2)

Mover o bloco de gate fora-horário (linhas 619–653) para **depois** do passo 4B:

- Diretor: nunca aplica.
- **Associado (Maya/Relacionamento): nunca aplica — atende 24/7** (boletos, reboque, sinistro, FAQ).
- Lead (Vinicius/vendas): aplica como hoje (debounce 30 min via `ultima_msg_fora_horario_em`).

### Correção 3 — Saudação + identificação canônicas (R1+R2+R3)

Novo gate logo após carregar `contato`, antes do gate de CPF atual:

1. **Cálculo de "precisa saudar"**:
   `precisaSaudar = !contato.ultima_interacao || (now - contato.ultima_interacao) > 2h || dia_brt(ultima_interacao) !== dia_brt(hoje)`.

2. **Identificado?**
   `identificado = (contato.cpf && contato.sga_associado_encontrado !== null) || contato.nome_confirmado_em`.

3. **Se `precisaSaudar` E `!identificado`**: envia mensagem padrão de saudação (R1). Grava `ultima_saudacao_em` para não repetir saudação dentro da janela. `return`.

4. **Próxima mensagem (sem ser saudação)** — parsing canônico:
   - **CPF** (11 dígitos válidos por DV) → caminho atual (lookup SGA + override + popula `contato.cpf`).
   - **Nome completo** (regex `^[A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,})+$`, ≥10 chars) → grava `contato.nome` + `contato.nome_confirmado_em = now()`.
   - **Qualquer outro texto** (incluindo CPF inválido, 1 palavra, números soltos) → repete saudação com debounce 2 min (`ultima_msg_continuidade_em`). Incrementa `cpf_tentativas_invalidas`; 3ª tentativa oferece transbordo humano (já implementado).
   - `return` em todos os casos acima.

5. **Mensagem subsequente já identificada**: envia liberação (R3) **uma única vez** (flag de "resposta de boas-vindas pós-identificação" em coluna nova `liberacao_enviada_em` OU detectada pela presença de `nome_confirmado_em`/`cpf` recentes sem ainda ter sido respondido) e **segue** o fluxo normal na mesma rodada.

### Correção 4 — Observabilidade

Estender o log `[maya_config]` (linha 656) com `audiencia_final` (`diretor|associado|lead`), `motivo_audiencia` (`telefone_match|cpf_cache|sga_override|fallback_lead`) e `gate_disparado` (`saudacao|identificacao_invalida|liberacao|fora_horario|nenhum`).

### Migration

```sql
ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS sga_associado_status text,
  ADD COLUMN IF NOT EXISTS sga_associado_id uuid,
  ADD COLUMN IF NOT EXISTS ultima_saudacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS nome_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_enviada_em timestamptz;
```

### Memória

Atualizar `mem://logic/operations/maya-config-aplicada-em-todas-audiencias`, `mem://logic/operations/maya-nunca-deixa-vacuo` e `mem://index.md`:

- Audiência ASSOCIADO: detectada por (telefone em `associados`) OU (CPF cacheado em `agente_ia_contatos`) OU (override SGA da rodada).
- Gate fora-horário aplica **apenas a LEAD** (Vinicius). Maya/Relacionamento atende 24/7.
- **Identificação canônica = 2 caminhos únicos: CPF válido (11 dígitos + DV) OU Nome completo (≥2 palavras alfabéticas, ≥10 chars).** Nada mais libera o fluxo.
- Saudação obrigatória em (primeira msg do dia BRT) OU (>2h sem interagir) E `!identificado`. Debounce em `ultima_saudacao_em`.

---

## Arquivos impactados

- `supabase/functions/agente-consultor-ia/index.ts` — novos gates (saudação, validação nome/CPF, liberação), correção de audiência, gate fora-horário ciente
- 1 migration (5 colunas em `agente_ia_contatos`)
- `src/integrations/supabase/types.ts` — regen pós-migration
- 3 memórias atualizadas

## Não-objetivos

- Não criar UI nova; configurações continuam em Configurações › Agente Consultor IA + `maya_ia_comportamento`/`maya_ia_faq`.
- Não alterar as tools `consultar_boletos_associado` / `solicitar_atendente_humano`.
- Não tocar no branch LEAD além do gate fora-horário e da identificação por nome.
