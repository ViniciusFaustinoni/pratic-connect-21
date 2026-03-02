
# Substituicao: "Cobertura Total" → "Protecao 360"

## Estrategia

A coluna do banco de dados `cobertura_total` **nao sera renomeada**. Renomear colunas quebraria dezenas de queries, types auto-gerados e edge functions. A mudanca e **apenas nos textos exibidos ao usuario** (labels, tooltips, mensagens, notificacoes WhatsApp, toasts, prompts de IA).

Nomes de variaveis internas (`temCoberturaTotal`, `coberturaTotal`, etc.) tambem permanecem inalterados - sao codigo interno, nao visivel ao usuario.

---

## Arquivos a editar (21 arquivos)

### Frontend - Componentes (4 arquivos)

**1. `src/components/veiculos/BadgeCobertura.tsx`**
- `'Cobertura Total'` → `'Proteção 360º'`
- `'Veículo com cobertura total ativa...'` → `'Veículo com Proteção 360º ativa...'`
- `'Aguardando instalação para cobertura total'` → `'Aguardando instalação para Proteção 360º'`
- `'Cobertura Total Ativa'` → `'Proteção 360º Ativa'`

**2. `src/components/cadastro/StatusCoberturaCard.tsx`**
- `'Cobertura Total'` → `'Proteção 360º'`
- `'liberar a cobertura total'` → `'liberar a Proteção 360º'`

**3. `src/components/eventos/NovoSinistroModal.tsx`**
- `'Cobertura total: qualquer tipo permitido'` (comentario, manter ou trocar)
- `'Veículo sem cobertura total para este tipo...'` → `'Veículo sem Proteção 360º...'`
- `'Sinistro roubo/furto sem cobertura total'` (log, manter)

**4. `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`**
- `'A cobertura total será ativada...'` → `'A Proteção 360º será ativada...'`

### Frontend - Pages (6 arquivos)

**5. `src/pages/cadastro/PropostaAnalise.tsx`**
- `'Cobertura Total'` → `'Proteção 360º'`
- `'A cobertura total será ativada...'` → `'A Proteção 360º será ativada...'`
- `'cobertura total para o veículo'` → `'Proteção 360º para o veículo'`

**6. `src/pages/cadastro/VistoriaCompletaAnalise.tsx`**
- `'liberar a cobertura total'` → `'liberar a Proteção 360º'`
- `'Cobertura total liberada'` → `'Proteção 360º liberada'`

**7. `src/pages/instalador/ExecutarVistoriaCompleta.tsx`**
- `'ativos com cobertura total'` → `'ativos com Proteção 360º'`

**8. `src/pages/public/CotacaoContratacao.tsx`**
- `'Cobertura Total Ativada'` → `'Proteção 360º Ativada'`
- `'cobertura total'` → `'Proteção 360º'`
- `'Cobertura total ativada'` → `'Proteção 360º ativada'`

**9. `src/pages/public/AcompanhamentoProposta.tsx`**
- `'Cobertura Total Ativa!'` → `'Proteção 360º Ativa!'`
- `'cobertura total ativa'` → `'Proteção 360º ativa'`
- `'Cobertura Total (após instalação)'` → `'Proteção 360º (após instalação)'`
- `'para cobertura total'` → `'para Proteção 360º'`

**10. `src/pages/app/AppHome.tsx`**
- Comentarios com "cobertura total" → atualizar

### Frontend - Hooks (4 arquivos)

**11. `src/hooks/useMinhasCoberturasApp.ts`**
- `'você terá cobertura total incluindo...'` → `'você terá Proteção 360º incluindo...'`

**12. `src/hooks/useVistoriaCompleta.ts`**
- `'Cobertura total ativada'` (descricao log) → `'Proteção 360º ativada'`
- `'Veículo aprovado... Cobertura total ativada.'` → `'... Proteção 360º ativada.'`

**13. `src/hooks/useVistoriaCompletaAnalise.ts`**
- `'Cobertura total liberada'` → `'Proteção 360º liberada'`
- Toast: `'Cobertura total liberada'` → `'Proteção 360º liberada'`

**14. `src/hooks/useAppAssociadoRealtime.ts`**
- Toast: `'Cobertura Total Ativada!'` → `'Proteção 360º Ativada!'`

### Frontend - Data (1 arquivo)

**15. `src/data/planosPrecos.ts`**
- Incendio descricao: `'Cobertura total'` → `'Proteção 360º'` (se fizer sentido no contexto — pode ser "Cobertura completa" aqui, pois refere-se a cobertura do incendio e nao ao nivel de protecao)

### Backend - Edge Functions (5 arquivos, requerem deploy)

**16. `supabase/functions/notificar-cliente/index.ts`**
- Template WhatsApp `cobertura_total_ativada`: titulo `'Cobertura Total Ativada!'` → `'Proteção 360º Ativada!'`
- Corpo: `'COBERTURA TOTAL'` → `'PROTEÇÃO 360º'`
- Mensagem instalacao: `'Cobertura Total'` → `'Proteção 360º'`
- Mensagem ativo: `'Cobertura Total (Roubo, Furto...)'` → `'Proteção 360º (Roubo, Furto...)'`
- **Nota**: A chave do objeto `cobertura_total_ativada` permanece (e codigo interno), apenas os textos mudam

**17. `supabase/functions/assistente-chat/index.ts`**
- Prompt da IA: todas as mencoes de "cobertura total" → "Proteção 360º"
- Mensagens de bloqueio: `'cobertura total'` → `'Proteção 360º'`
- Contexto do veiculo: `'Total (inclui Assistência 24h)'` → `'Proteção 360º (inclui Assistência 24h)'`

**18. `supabase/functions/whatsapp-webhook/index.ts`**
- Prompt da IA (duplicado do assistente-chat): mesmas substituicoes
- Mensagens de bloqueio: `'cobertura total'` → `'Proteção 360º'`

**19. `supabase/functions/criar-sinistro/index.ts`**
- Log: `'cobertura total'` → `'Proteção 360º'` (logs podem manter, mas mensagem de erro ao usuario deve mudar)
- Mensagem de erro: `'para cobertura total'` → `'para Proteção 360º'`

**20. `supabase/functions/processar-vistoria/index.ts`**
- Comentarios internos (opcional, mas recomendado para consistencia)

**21. `supabase/functions/gerar-faturas-mensais/index.ts`**
- Apenas codigo interno (`.cobertura_total`), **sem textos visíveis** — nenhuma mudanca necessaria

### Nao sera alterado

- **Banco de dados**: coluna `cobertura_total` permanece (renomear quebraria types auto-gerados e dezenas de queries)
- **`src/integrations/supabase/types.ts`**: auto-gerado, nao editavel
- **Variaveis internas**: `temCoberturaTotal`, `coberturaTotal`, `veiculoCoberturaTotal` etc. permanecem
- **Chaves de objeto**: `cobertura_total_ativada` (tipo de notificacao) permanece como identificador interno
- **Migrations antigas**: sao historicas, nao se editam

---

## Impacto em logica

**Nenhum.** Todas as mudancas sao em strings de exibicao (labels, tooltips, toasts, mensagens de erro, templates WhatsApp, prompts de IA). A logica booleana (`cobertura_total === true`) permanece identica.

## Deploy necessario

Apos editar as edge functions (itens 16-20), sera necessario fazer deploy de:
- `notificar-cliente`
- `assistente-chat`
- `whatsapp-webhook`
- `criar-sinistro`
- `processar-vistoria`
