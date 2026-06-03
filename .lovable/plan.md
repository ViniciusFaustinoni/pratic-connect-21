## Objetivo

Permitir que o time de Relacionamento edite — sem código — o **conhecimento (FAQ)** e o **comportamento (persona/regras/saudação)** da Maya IA, hoje hardcoded em `supabase/functions/agente-consultor-ia/index.ts`.

## Onde a Maya vive hoje

- `agente-consultor-ia/index.ts` monta 3 variantes de `systemPrompt` (diretor, associado, lead/visitante).
- Sidebar do Relacionamento atual (`AppSidebar.tsx`): Transbordo, Análises, E-mails.

## Entrega

### 1. Persistência (Supabase)

Duas tabelas novas, RLS por role (Relacionamento + Diretoria):

**`maya_ia_comportamento`** (1 linha por audiência — `associado`, `lead`, `diretor`)
- `audiencia` (enum, PK), `nome_agente`, `persona` (texto longo), `regras_absolutas` (texto), `tom_voz` (texto), `saudacao_inicial` (texto), `atualizado_em`, `atualizado_por`.

**`maya_ia_faq`** (base de conhecimento)
- `id`, `categoria` (ex: planos, cobertura, cobrança, sinistro, geral), `pergunta`, `resposta`, `palavras_chave` (text[]), `audiencias` (text[] — quais variantes recebem), `ativo`, `ordem`, `atualizado_em`, `atualizado_por`.

Seed inicial = extração do conteúdo hardcoded de hoje (persona/regras de cada audiência + FAQs implícitas no prompt).

### 2. Edge `agente-consultor-ia`

- Carregar `maya_ia_comportamento` da audiência atual e substituir os blocos hardcoded por: `Você é {nome_agente}. {persona}\n\n## REGRAS\n{regras}\n\n## TOM\n{tom_voz}\n\n## SAUDAÇÃO\n{saudacao}`.
- Injetar `maya_ia_faq` filtrada pela audiência como bloco `## BASE DE CONHECIMENTO` no fim do system prompt (somente itens `ativo=true`, ordenado).
- Cache de 60s em memória para evitar 1 query por mensagem; fallback para o texto hoje hardcoded se a tabela vier vazia (segurança).

### 3. UI: novo item na sidebar do Relacionamento

`AppSidebar.tsx` → adicionar no grupo Relacionamento:
- **"Maya IA"** → rota `/relacionamento/maya-ia` (ícone `Bot`).

Página com 2 abas (shadcn Tabs):

**Aba "Comportamento"**
- Seletor de audiência (Associado / Lead / Diretor) — pills no topo.
- Campos editáveis em cards (Textarea grande + Input):
  - Nome do agente (input curto)
  - Persona (textarea — quem ela é, papel)
  - Regras absolutas (textarea — o que nunca fazer)
  - Tom de voz (textarea)
  - Saudação inicial (textarea)
- Cada campo tem um `<FieldHint>` (tooltip já existente em `src/components/admin/planos/FieldHint.tsx`) com explicação prática + exemplo de impacto na resposta.
- Botão "Salvar alterações" no rodapé sticky; toast de confirmação; mostra "última edição por X em Y".
- Botão "Restaurar padrão" (volta ao seed) por audiência.

**Aba "Conhecimento (FAQ)"**
- Filtro por categoria (chips) + busca por texto.
- Lista em cards expansíveis (Accordion): cada item mostra pergunta + resposta truncada; expandir abre edição inline (pergunta, resposta rich textarea, categoria select, audiências multi-select via Checkbox, palavras-chave como tag input, toggle ativo).
- Drag handle para reordenar (`ordem`) — opcional v1, pode ser só Input numérico.
- Botão "+ Novo conhecimento" abre Dialog com mesmo formulário em branco.
- Tooltips em cada campo (palavras-chave: "Termos que ajudam a Maya a recuperar este item — separe por vírgula"; audiências: "Quais perfis recebem este conhecimento no prompt"; etc.).
- Ações por card: Editar, Duplicar, Desativar/Ativar, Excluir (com confirmação).

### 4. Permissão

- Visível para `relacionamento`, `gerente_relacionamento`, `diretor`, `desenvolvedor`.
- `usePermissions` ganha flag `canManageMayaIA` derivada dessas roles.

## Detalhes técnicos

- Hooks novos: `useMayaComportamento(audiencia)`, `useMayaFaq()` — React Query com `invalidate` no save.
- Validação client: persona/regras não vazias; pergunta+resposta obrigatórias no FAQ.
- Sem realtime (não é necessário); edge invalida cache local a cada 60s.
- Migration: tabelas + GRANT (`authenticated` + `service_role`) + RLS via `has_role` para Relacionamento/Diretoria; seed.

## Fora de escopo

- Versionamento/histórico de edições (fica para v2; por ora guardamos só `atualizado_por`+`atualizado_em`).
- Editor de tools/funções da Maya (continua no código).
- Configuração da Maya em outros canais (Vinicius/agente-consultor-ia para vendas continua usando os mesmos blocos via audiência `lead`).
