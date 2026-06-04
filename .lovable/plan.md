# Diagnóstico

Investigação no banco + edge `agente-consultor-ia` + componente `ChatPanel` revelou **duas causas independentes**, sem suposição:

## Bug 1 — Chat não atualiza em tempo real
- `ChatPanel.tsx` (linha 94-104) assina canal Realtime `chat-ia-${telefoneComDDI}` filtrando `whatsapp_mensagens`.
- **Mas `whatsapp_mensagens` NÃO está na publicação `supabase_realtime`** (consulta a `pg_publication_tables` retornou vazio para `%whatsapp%`).
- Resultado: nenhum INSERT/UPDATE dispara o canal → o painel só atualiza quando o `refetchInterval: 60_000` do `useWhatsAppHistorico` roda.

## Bug 2 — IA se apresenta como "Vinicius" mesmo com `vendas` desativada
- O roteador canônico (`lib/roteador.ts`) **escolhe corretamente** a habilidade "Atendimento Pratic" para a audiência `lead` — verificado nos logs (`[habilidade_selecionada]`).
- **Mas o `systemPrompt` ignora isso**: `agente-consultor-ia/index.ts` (linhas 989-1280) tem três branches hardcoded por audiência. O branch `lead` (linha 1205) ainda monta literalmente:
  ```
  Você é ${nomeAgente}, consultor virtual de vendas da PRATICCAR…
  "${apresentacao}"  ← apresentação vem do legado agente_ia_config
  ```
  …com todo o fluxo de cotação (consultar_placa, calcular_cotacao, registrar_cotacao etc.). É isso que produz o "Olá! Sou o Vinicius, consultor virtual…" do print.
- O `nomeAgente` e `apresentacao` vêm de `agente_ia_config` legado, não da habilidade roteada.

## Bug 2b — "Oi, Thais!" para um número do Vinicius
- `agente_ia_contatos` para `5521992593830` tem `nome='THAIS GURUCEAGA DOS SANTOS'`, `sga_associado_encontrado=true`, `cpf=15230046732` — cache antigo de quem usou o número antes.
- O agente trata o usuário pelo nome cacheado sem revalidar identidade.
- **Aqui há um conflito lógico que exige decisão sua** — opções na seção abaixo.

---

# Correções

## Parte A — Realtime do chat (sem ambiguidade)
Migração:
```sql
ALTER TABLE public.whatsapp_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
-- Idem para whatsapp_ia_pausas (transbordos em tempo real)
ALTER TABLE public.whatsapp_ia_pausas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_ia_pausas;
```

## Parte B — Prompt dirigido pela habilidade ativa
- Em `supabase/functions/agente-consultor-ia/index.ts`:
  - Quando `roteamento.habilidade` for resolvida, usar **dela** como fonte do prompt para TODAS as audiências:
    - `nome_agente`, `persona`, `regras_absolutas`, `tom_voz`, `saudacao_inicial`.
  - **Remover** o branch hardcoded de "consultor virtual de vendas" do `lead` (linhas 1188-1356 do bloco lead). Lead, associado e diretor passam a usar um único builder que injeta a configuração da habilidade + FAQ + tools de suporte (`solicitar_atendente_humano`).
  - Manter o branch `diretor` apenas para o contexto extra de relatórios (ferramentas administrativas), mas **substituir o `nomeAgente` por `habilidade.nome_agente`** ("Atendimento Pratic").
  - Tools de vendas (`consultar_placa`, `calcular_cotacao`, `registrar_cotacao`, `salvar_dados_cliente`, `obter_opcoes_vencimento`) **deixam de ser anexadas** — coerente com a decisão anterior de desligar a IA de vendas.
- Limpar referências visíveis "Vinicius" restantes em comentários/log labels do `whatsapp-webhook` e nos toasts do `AgenteConsultorIA.tsx` (renomear para "Atendimento Pratic").

## Parte C — Identificação por cache antigo (CONFLITO — preciso da sua decisão)

Hoje a IA confia em `agente_ia_contatos.nome` mesmo quando o número trocou de dono. Três caminhos possíveis (não posso escolher sem você):

**Opção 1 — Lead nunca é tratado pelo nome cacheado**
A IA só usa o nome do contato quando audiência é `associado` ou `diretor` (vínculo confirmado pelo telefone do SGA). Para `lead`, ignora `contato.nome` e usa saudação genérica até o usuário informar nome/CPF na conversa atual.
- Prós: simples, resolve o caso Vinicius/Thais imediatamente.
- Contras: lead que volta dias depois precisa se apresentar de novo.

**Opção 2 — Reidentificação obrigatória após X horas de silêncio**
Aplicar o gate canônico de saudação+identificação (memória `maya-saudacao-e-identificacao-canonica`) também para `lead`. Se passou >2h da última interação OU é primeira msg do dia, a IA pede confirmação de nome/CPF antes de tratar pelo nome. Se o usuário responder com nome diferente do cacheado, atualiza `agente_ia_contatos`.
- Prós: alinha o lead ao mesmo padrão de associado/diretor, sem perder histórico.
- Contras: adiciona uma troca extra de mensagens em todo retorno de lead após 2h.

**Opção 3 — Confiar sempre no `pushName` da última mensagem WhatsApp**
Usar o nome de perfil do WhatsApp da mensagem atual como fonte da verdade, sobrescrevendo `agente_ia_contatos.nome` se divergir.
- Prós: zero atrito, segue a realidade do aparelho.
- Contras: muita gente tem `pushName` ruim ("João da Silva ❤️", "iPhone do Carlos") — pode degradar o tratamento profissional.

---

# Detalhes técnicos (resumo)

| Arquivo | Mudança |
|---|---|
| nova migração SQL | `ALTER PUBLICATION supabase_realtime ADD TABLE …` para `whatsapp_mensagens` + `whatsapp_ia_pausas`, com `REPLICA IDENTITY FULL` |
| `supabase/functions/agente-consultor-ia/index.ts` | Builder único de prompt a partir de `roteamento.habilidade`; remoção do branch "lead = pitch Vinicius"; remoção das tools de vendas |
| `src/pages/configuracoes/AgenteConsultorIA.tsx` | Toasts/labels "Vinicius" → "Atendimento Pratic" |
| `supabase/functions/whatsapp-webhook/index.ts` | Comentários/logs neutros |
| Memórias | atualizar `mem://logic/ia/habilidades-canonicas` registrando que o systemPrompt agora é dirigido pela habilidade roteada |

# Pergunta antes de implementar

**Qual opção para o cache de nome (Bug 2b)?** Opção 1, 2 ou 3 — sem isso só corrijo realtime + persona, e o caso "Thais" pode voltar em outro número herdado.
