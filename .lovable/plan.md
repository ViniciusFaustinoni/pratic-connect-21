

# Plano: Seção "Agente Consultor IA" nas Configurações

## Resumo

Nova aba "Agente Consultor IA" nas Configurações, visível apenas para Diretor. Quatro sub-abas: Planos do Agente, Comportamento, Contatos/Conversas, e Landing Page. Requer nova tabela de configuração e alteração na tabela `planos`.

## 1. Banco de Dados (SQL Migration)

### Coluna em `planos`
- `disponivel_agente` BOOLEAN DEFAULT false
- `agente_descricao` TEXT (instruções para o agente sobre o plano)

### Nova tabela `agente_ia_config`
- `id` UUID PK
- `chave` TEXT UNIQUE NOT NULL (ex: 'nome_agente', 'apresentacao_inicial', 'instrucoes_comportamento', 'responder_fora_horario', 'horario_comercial', 'mensagem_fora_horario', 'dados_cotacao_opcionais', 'mensagem_link_cotacao', 'followup_ativo', 'followup_config')
- `valor` TEXT NOT NULL
- `updated_at` TIMESTAMPTZ DEFAULT now()
- `updated_by` UUID references auth.users

RLS: leitura para authenticated, escrita restrita a Diretor via `has_role`.

Inserir dados iniciais com valores padrão para todas as chaves.

### Nova tabela `agente_ia_contatos`
- `id` UUID PK
- `telefone` TEXT NOT NULL
- `nome` TEXT
- `status` TEXT DEFAULT 'em_conversa' ('em_conversa', 'cotacao_enviada', 'followup_ativo', 'convertido', 'encerrado', 'atendimento_humano')
- `ultima_interacao` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ DEFAULT now()
- UNIQUE(telefone)

RLS: leitura para Diretor.

## 2. Nova Página: `src/pages/configuracoes/AgenteConsultorIA.tsx`

Componente com `Tabs` (4 abas):

### Aba 1 — Planos Disponíveis
- Query `planos` ativos, lista com toggles:
  - Toggle A: `visivel_landing` (já existe)
  - Toggle B: `disponivel_agente` (novo)
- Campo "Descrição para o Agente" (`agente_descricao`)
- Preview de imagem + botão "Regenerar imagem" (placeholder, chama edge function de geração)
- Salva via update na tabela `planos`

### Aba 2 — Comportamento do Agente
- Formulário lendo/escrevendo em `agente_ia_config` (chave/valor)
- Seção Identidade: nome, apresentação inicial, instruções gerais
- Toggle responder fora do horário + campos condicionais (horário, mensagem)
- Seção Fluxo de Cotação: lista de dados fixos/opcionais com toggles, mensagem do link
- Seção Follow-up: toggle ativo + 3 follow-ups configuráveis (horas + mensagem) armazenados como JSON na chave `followup_config`

### Aba 3 — Contatos e Conversas
- Query `agente_ia_contatos` com filtros (status, período)
- Tabela: nome, telefone, status (badge colorido), última interação
- Botão "Ver conversa" (abre dialog com mensagens de `whatsapp_fila_ia` filtradas por telefone)
- Botão "Assumir conversa" (muda status para `atendimento_humano`)

### Aba 4 — Landing Page
- Iframe renderizando `/planos`
- Botão "Copiar link" e "Abrir em nova aba"

## 3. Roteamento e Layout

### `ConfiguracoesLayout.tsx`
- Nova tab: `{ path: '/configuracoes/agente-consultor-ia', label: 'Agente Consultor IA', icon: Bot, diretorOnly: true }`
- Adicionar flag `diretorExclusive?: boolean` para restringir apenas a Diretor (sem Admin/Dev)

### `App.tsx`
- Rota: `agente-consultor-ia` dentro do grupo `configuracoes`

### `src/pages/configuracoes/index.tsx`
- Exportar `AgenteConsultorIA`

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| SQL (migração) | ADD COLUMNS em `planos`, criar `agente_ia_config` e `agente_ia_contatos` |
| `src/pages/configuracoes/AgenteConsultorIA.tsx` | **Novo** — página com 4 abas |
| `src/pages/configuracoes/ConfiguracoesLayout.tsx` | Nova tab com ícone Bot |
| `src/pages/configuracoes/index.tsx` | Export |
| `src/App.tsx` | Rota nova |

