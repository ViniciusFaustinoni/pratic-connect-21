## Objetivo

Adicionar um botão "Ativar/Desativar Agente IA Vinicius" como **kill switch global**. Quando desativado, o agente para imediatamente de responder qualquer mensagem no WhatsApp, sem afetar o atendimento humano.

## Comportamento

- **Local do botão**: topo da tela `Configurações → Agente Consultor IA`, em destaque (ao lado do título "Agente Consultor IA"), com badge de status (Ativo / Desativado).
- **Quando desativado**:
  - O agente **não responde nenhuma mensagem** (nem leads novos, nem follow-ups, nem cotação).
  - As mensagens recebidas continuam sendo registradas normalmente (histórico preservado).
  - Conversas em andamento ficam paradas — humano pode assumir manualmente pela aba "Contatos".
- **Quando reativado**: volta a responder normalmente nas próximas mensagens recebidas.

## Implementação técnica

### 1. Configuração (DB)
- Inserir nova chave em `agente_ia_config`:
  - `chave = 'agente_ativo'`, `valor = 'true'` (default ligado).
- Migration idempotente com `ON CONFLICT DO NOTHING`.

### 2. Backend — kill switch
- `supabase/functions/agente-consultor-ia/index.ts`: logo após carregar `config` (linhas ~73-87), checar `config.agente_ativo`. Se for `'false'`, retornar `{ success: true, ignored: 'agente_desativado' }` sem chamar IA nem enviar mensagem.
- Garantir que `agente_ativo` seja lido **antes** de qualquer fluxo (lead novo, retomada, diretor — exceto comandos de diretor, que continuam funcionando para permitir reativar via WhatsApp se quisermos no futuro; nesta entrega: desativado bloqueia tudo, inclusive diretor).

### 3. Frontend — UI do toggle
- `src/pages/configuracoes/AgenteConsultorIA.tsx`: adicionar bloco no topo do componente principal (acima das `Tabs`):
  - Card com ícone `Power`, título "Status do Agente", `Switch` grande, badge "Ativo" (verde) / "Desativado" (vermelho).
  - Texto explicativo: *"Quando desativado, o Vinicius não responde nenhuma mensagem no WhatsApp. Use para pausar o agente em casos críticos."*
  - Confirmação via `toast` ao alternar.
- Reutilizar a mesma query/mutation já existente (`agente-ia-config` + `saveConfig`).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (nova chave `agente_ativo`)
- `supabase/functions/agente-consultor-ia/index.ts` (guard logo após carregar config)
- `src/pages/configuracoes/AgenteConsultorIA.tsx` (UI do toggle no topo)

## Fora do escopo

- Não altera os webhooks (`whatsapp-meta-webhook`, `whatsapp-webhook`) — o bloqueio é centralizado no `agente-consultor-ia` para garantir um único ponto de verdade.
- Não desliga follow-ups já agendados em filas externas (se houver) — apenas o handler do agente para de responder.
