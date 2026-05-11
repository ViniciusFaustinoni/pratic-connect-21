## Diagnóstico (logs últimas 48h)

Consulta em `whatsapp_mensagens` (saída):

| status | provedor | total |
|---|---|---|
| enviada | meta_oficial | 19 |
| **erro** | **meta_oficial** | **12** |
| enviada | evolution | 1 |

**Todos os 12 erros têm o mesmo `erro_mensagem`:**
> "Bloqueado: Meta API ativa requer template_name. Texto livre não é entregue fora da janela 24h. Use allow_text=true para respostas na janela 24h."

Origem: o sender unificado `whatsapp-send-text` (linha 247) **bloqueia corretamente** qualquer envio de texto livre quando o provedor ativo é Meta — porque fora da janela 24h Meta exige template aprovado. O bug não está no sender; está nos chamadores que ainda mandam **texto livre sem `template_name`** (ou usam nomes de parâmetros errados que caem no mesmo caminho).

### Chamadores defeituosos identificados

Mapeei todos os `invoke('whatsapp-send-text', ...)` em `supabase/functions/**` e cruzei com a presença de `template_name` / `allow_text` no mesmo bloco. Resultado:

| # | Edge function | Linha | Quem recebe | Problema |
|---|---|---|---|---|
| 1 | `notificar-inicio-rota` | 242 | Técnico/Vistoriador (NOVA TAREFA) | Texto livre puro — Meta bloqueia |
| 2 | `contrato-gerar` | 1409 | Novo titular pós-troca | Texto livre puro — Meta bloqueia |
| 3 | `_shared/enviar-termo-filiacao-whatsapp.ts` | 151 | Vendedor (confirmação termo enviado) | Texto livre puro — Meta bloqueia |
| 4 | `create-user` | 251 | Agência recém-cadastrada | Usa params **errados** (`template`, `params`) → cai como texto livre → bloqueado |
| 5 | `gerar-link-vistoriador-prestador` | 213 | Vistoriador parceiro | Usa `template_nome` (errado, deveria ser `template_name`) → cai no caminho `allow_text=true`, mas fora da janela 24h Meta também rejeita |
| 6 | `aprovar-troca-cadastro` | 201 | Vendedor | ✅ Já força `force_provider:'evolution'` — OK, não está nos erros |
| 7 | `notificar-cliente` | 636 | Cliente | ✅ Já injeta `template_name` com fallback `sinistro_atualizado` — OK |

Também existem 4 templates de troca de titularidade ainda **PENDING** no Meta (`troca_titularidade_*`) — fora do escopo (depende da Meta aprovar).

## Correção

### A. Fix nos 5 chamadores quebrados — usar templates Meta aprovados

| # | Função | Template aprovado a usar | Variáveis (corpo) | Botão? |
|---|---|---|---|---|
| 1 | `notificar-inicio-rota` | `servico_atribuido_v1` | `[primeiroNomeTec, "INSTALAÇÃO/VISTORIA — placa LTB4J74", "12/05/2026 Tarde — Cliente XYZ — endereço"]` | — |
| 2 | `contrato-gerar` (troca) | `force_provider:'evolution'` (texto livre via Evolution; Meta não tem template específico para esse aviso) | — | — |
| 3 | `enviar-termo-filiacao-whatsapp` (vendedor) | `force_provider:'evolution'` (notificação interna ao vendedor — mesmo padrão do `aprovar-troca-cadastro`) | — | — |
| 4 | `create-user` (agência) | Renomear `template`→`template_name` e `params`→`template_params`. Template `boas_vindas_agencia_v1` já existe | `[nomeIdentificado, magicLink]` | — |
| 5 | `gerar-link-vistoriador-prestador` | `tarefa_vistoriador_v2` (já aprovado, 4 params) | `[primeiroNome, nomeAssociado, cidade, dataHora]` | — |

### B. Guard defensivo no sender `whatsapp-send-text`

Adicionar tradução automática de aliases legados antes da decisão Meta/free-text, para nunca mais silenciosamente cair no bloqueio por um nome de campo trocado:

- `template` → `template_name`
- `template_nome` → `template_name`
- `params` / `variaveis` (objeto `{1:..,2:..}` ou array) → `template_params` (array ordenado)

E **logar com warning explícito** o caller (header `x-edge-function-name` quando disponível) toda vez que cair no caminho "texto livre bloqueado", para acelerar futuras detecções.

### C. Verificação pós-deploy

Após deploy, simular um disparo de cada um dos 5 fluxos (técnico, contrato troca, vendedor confirmação, criação de agência, link vistoriador prestador) e checar `whatsapp_mensagens` — todos devem entrar como `status='enviada'`.

## Fora de escopo

- Aprovação dos templates `troca_titularidade_*` na Meta (depende da Meta).
- Reescrita do orquestrador Meta/Evolution.
- UI/preview de templates.

## Arquivos que serão tocados

1. `supabase/functions/notificar-inicio-rota/index.ts`
2. `supabase/functions/contrato-gerar/index.ts`
3. `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts`
4. `supabase/functions/create-user/index.ts`
5. `supabase/functions/gerar-link-vistoriador-prestador/index.ts`
6. `supabase/functions/whatsapp-send-text/index.ts` (guard defensivo + log)
