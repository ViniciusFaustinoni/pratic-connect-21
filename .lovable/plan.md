

# Ações Pós-Confirmação da Atribuição de Vistoriador Prestador

## Resumo

Ao confirmar a atribuição no `PainelAtribuicaoPrestador`, encadear 3 ações: gerar link tokenizado, enviar WhatsApp com dados completos da instalação, e registrar lançamento financeiro. Tudo via uma nova edge function `gerar-link-vistoriador-prestador`.

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | **Criar** — tabela `vistoria_prestador_links` |
| `supabase/functions/gerar-link-vistoriador-prestador/index.ts` | **Criar** — Edge function com as 3 ações |
| `src/pages/public/VistoriaPrestador.tsx` | **Criar** — Página pública `/vistoria-prestador/:token` |
| `src/components/instalacoes/PainelAtribuicaoPrestador.tsx` | **Editar** — Chamar edge function em vez de update direto |
| `src/App.tsx` | **Editar** — Adicionar rota pública |

## 1. Migration SQL — `vistoria_prestador_links`

Nova tabela separada da `instalacao_prestador_links` (que é para prestadores de assistência):

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| instalacao_id | uuid FK → instalacoes |
| vistoriador_prestador_id | uuid FK → vistoriadores_prestadores |
| token | text UNIQUE, default `gen_random_uuid()` |
| status | text DEFAULT 'aguardando' (aguardando/em_execucao/concluida/cancelada) |
| valor | numeric(10,2) |
| chegada_em | timestamptz |
| concluida_em | timestamptz |
| foto_comprovante_url | text |
| whatsapp_enviado | boolean DEFAULT false |
| whatsapp_erro | text |
| atribuido_por | uuid FK → profiles |
| created_at / updated_at | timestamptz |

Sem `expires_at` — válido até conclusão ou cancelamento, conforme requisito.

RLS: SELECT público (para acesso via token sem login), INSERT/UPDATE restrito a authenticated + service_role.

## 2. Edge Function `gerar-link-vistoriador-prestador`

Recebe: `{ instalacao_id, vistoriador_prestador_id, valor, atribuido_por }`

**Ação 1 — Gerar link**: Verificar se já existe link ativo para esta instalação+prestador. Se sim, reusar o token. Se não, inserir em `vistoria_prestador_links`. URL: `https://pratic-connect-21.lovable.app/vistoria-prestador/{token}`

**Ação 2 — WhatsApp**: Buscar dados completos (instalação com veículo, associado, endereço) e prestador. Validar que nenhum campo obrigatório está vazio. Invocar `whatsapp-send-text` com mensagem formatada conforme template especificado (veículo, placa, endereço, data, associado, link). Registrar sucesso/falha na coluna `whatsapp_enviado`/`whatsapp_erro`.

**Ação 3 — Financeiro**: Inserir em `lancamentos_contabeis` + `lancamentos_partidas` com origem `vistoria_prestador`, histórico descritivo, conta débito = conta de despesa de vistoria prestador, conta crédito = provisão. Registrar também um lançamento mais simples se a tabela de contabilidade não tiver a categoria — usar `useLancamentosContabeis` pattern mas no server-side.

**Ação 4 — Auditoria**: Inserir em `logs_auditoria` com módulo `instalacoes`, ação `atribuir`, dados incluindo prestador, valor, token, resultado do WhatsApp.

**Retorno**: `{ success, token, url, whatsapp_enviado }`

## 3. Página pública `VistoriaPrestador.tsx`

Rota: `/vistoria-prestador/:token`

Estrutura idêntica à `PrestadorInstalacao.tsx` existente, mas consultando `vistoria_prestador_links` em vez de `instalacao_prestador_links`. Mesmos estados (aguardando → em_execução → concluída) com upload de foto. Quando status é `concluida` ou `cancelada`, exibir tela de encerramento amigável.

## 4. `PainelAtribuicaoPrestador.tsx` — Alterações

**`handleConfirmar`**: Substituir o update direto + `abrirWhatsAppWeb` pela chamada `supabase.functions.invoke('gerar-link-vistoriador-prestador', { body: {...} })`. O update de `vistoriador_prestador_id`, `valor_prestador`, `prestador_atribuido_em` na tabela `instalacoes` passa a ser feito pela edge function.

**`EstadoAtribuido`**: No botão "Reenviar link por WhatsApp", buscar o token existente em `vistoria_prestador_links` e reinvocar a edge function com flag `reenviar: true` (que não gera novo token, apenas reenvia WhatsApp).

## 5. `App.tsx`

Adicionar: `<Route path="/vistoria-prestador/:token" element={<VistoriaPrestador />} />`

