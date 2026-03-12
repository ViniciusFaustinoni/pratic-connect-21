
Objetivo: corrigir a raiz do problema de variável errada no botão do template (link público), garantindo consistência em todos os envios.

1) Diagnóstico da raiz (confirmado no código)
- O fluxo de aprovação/ativação chama `ativar-associado` (ver `usePropostasPendentes.ts`), e é ele que envia o template `cadastro_aprovado_botao`.
- Em `supabase/functions/ativar-associado/index.ts`, o 6º parâmetro do template está sendo `tokenPrimeiroAcesso` (UUID de `auth_tokens_primeiro_acesso`), não `contratos.link_token`.
- A página pública `/acompanhar/:token` busca exclusivamente `contratos.link_token` (ver `AcompanhamentoProposta.tsx`), então o token de primeiro acesso gera “Proposta não encontrada”.
- Há um segundo risco em `notificar-cliente`: fallback para `associado.id` quando não acha contrato (`const linkToken = contratoLink?.link_token || associado.id`), o que também pode quebrar link.

2) Correção proposta (implementação)
- Arquivo 1: `supabase/functions/ativar-associado/index.ts`
  - Resolver `link_token` do contrato correto (prioridade: contrato do `veiculo_id`; fallback por `associado_id`).
  - Parar de usar `tokenPrimeiroAcesso` como parâmetro de botão para `cadastro_aprovado_botao`.
  - Enviar parâmetros separados:
    - `template_params` = 5 variáveis de corpo
    - `template_button_params` = `[linkToken]`
  - Manter `auth_tokens_primeiro_acesso` apenas para fluxo `/app/criar-senha` (quando aplicável), sem misturar com `/acompanhar`.

- Arquivo 2: `supabase/functions/notificar-cliente/index.ts`
  - Substituir fallback inválido (`associado.id`) por resolução robusta de contrato/link.
  - Se não houver `link_token` válido: não enviar botão quebrado (fail-safe com log explícito).
  - Aplicar envio explícito de `template_button_params` nos 6 mapeamentos de `cadastro_aprovado_botao`.
  - Atualizar comentário/documentação interna (está desatualizado e induz erro).

3) Blindagem para “todas as variáveis corretas”
- Padronizar a montagem de parâmetros (5 body + 1 button) para evitar depender de split implícito.
- Validar contagem e conteúdo antes de invocar `whatsapp-send-text` (não permitir UUID de `associado.id`/`auth_token` no botão de `/acompanhar`).

Detalhes técnicos (resumo)
- Regra de ouro:
  - `/acompanhar/{{1}}` => `{{1}}` deve ser `contratos.link_token`.
  - Nunca usar `associado.id` nem `auth_tokens_primeiro_acesso.token` nesse botão.
- Fluxos impactados:
  - Ativação inicial (`ativar-associado`) e notificações via `notificar-cliente` com template de boas-vindas.
- Sem migração de banco necessária; correção é de lógica de Edge Functions.

4) Validação pós-correção (E2E)
- Reproduzir com o caso do Marcus.
- Confirmar no payload enviado ao `whatsapp-send-text`:
  - `template_params` (5 itens) corretos
  - `template_button_params[0] === contratos.link_token` esperado
- Abrir o link recebido no WhatsApp e validar carregamento da página pública de criação de conta.
- Testar pelo menos 2 cenários: ativação inicial e notificação de cobertura/instalação.
