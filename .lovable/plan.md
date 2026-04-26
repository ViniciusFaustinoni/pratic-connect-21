# Tela "Planos SGA (Hinova)" — visualização somente leitura

Criar uma área nova no sistema, separada dos planos locais, que **lista exatamente o que existe hoje no SGA** (planos/produtos + benefícios), com seus respectivos códigos. Nada é gravado, nada é sincronizado — é uma janela de leitura para a base da Hinova.

## O que o usuário verá

Nova rota: **`/configuracoes/integracoes/planos-sga`** (ou no menu "Integrações")

Duas abas:

1. **Produtos / Planos SGA** — tabela com:
   - Código do produto
   - Descrição
   - Tipo de veículo (carro, moto, etc.)
   - Base de cobrança (FIPE / valor fixo)
   - Formato (% ou R$)
   - Situação (ativo/inativo)
   - Regional vinculada
   - Botão "Ver detalhes" → abre dialog com o JSON completo retornado pela Hinova

2. **Benefícios SGA** — tabela com:
   - Código do benefício
   - Descrição
   - Situação (ativo/inativo/todos — filtro no topo)
   - Categoria/tipo (se vier no payload)

Botão **"Atualizar da Hinova"** no topo: refaz a chamada e recarrega a tabela.

Campo de busca por código ou nome em cada aba.

Aviso visual no topo: *"Esta tela é somente leitura. Reflete o cadastro atual no SGA. A criação de planos no SGA continua sendo feita pelo painel da Hinova."*

## Como funciona por trás

Reaproveita a infra já existente:

```text
Frontend (nova página)
   │
   ▼
Edge Function nova: sga-listar-catalogo
   │
   ├─ getHinovaSession()  ← já existe em _shared/hinova-client.ts
   │
   ├─ GET /listar/produto/
   └─ GET /listar/beneficio-por-situacao/{situacao}
   │
   ▼
Retorna JSON cru ao frontend (com cache curto de 5 min em memória da function)
```

Sem banco. Sem migration. Sem mexer em `planos`, `benefits`, `coberturas` nem nos códigos SGA já mapeados.

## Arquivos a criar

**Backend (1 edge function nova):**
- `supabase/functions/sga-listar-catalogo/index.ts`
  - Aceita `?tipo=produtos` ou `?tipo=beneficios&situacao=ativo|inativo|todos`
  - Usa `getHinovaSession` para auth
  - Retorna a resposta da Hinova como veio (sem transformar)
  - Cache em memória de 5 minutos por chave para não martelar a API

**Frontend (3 arquivos novos):**
- `src/pages/configuracoes/PlanosSGA.tsx` — página com tabs e tabelas
- `src/hooks/useSGACatalogo.ts` — 2 hooks (`useSGAProdutos`, `useSGABeneficios`) usando React Query
- Entrada no menu de Configurações → Integrações apontando para a nova rota

## O que NÃO faz parte deste plano

- Não cria planos novos no SGA (a API não permite — só GET)
- Não altera planos locais
- Não preenche `codigo_sga` automaticamente em coberturas/benefícios locais
- Não muda o fluxo de cadastro de associado
- Não toca em nenhuma migration de banco

## Fluxo de aprovação

Implemento exatamente isso. Se depois você quiser uma segunda fase (ex: ao lado de cada plano local, sugerir o produto SGA equivalente para preencher o `codigo_sga` num clique), a gente conversa em outro plano.
