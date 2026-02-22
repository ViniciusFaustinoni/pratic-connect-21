
# S02 — Tela Administrativa de Gestao de Sindicantes

## Resumo

Substituir a pagina basica `EmpresasSindicancia.tsx` por uma tela completa em `/eventos/sindicantes` com: 4 cards de resumo, tabela com filtros/busca, modal de cadastro com criacao automatica de usuario, e painel lateral de detalhe com historico e metricas.

---

## 1. Atualizar Edge Function `create-user`

**Arquivo:** `supabase/functions/create-user/index.ts`

A funcao ja suporta `tipo: 'prestador'` e `perfis: ['sindicante']`, mas a lista de roles com permissao para criar usuarios nao inclui `analista_eventos`. Precisamos adicionar.

**Alteracao (linha 73):**
```typescript
const allowedRoles = ['diretor', 'gerente_comercial', 'supervisor_vendas', 'analista_eventos'];
```

---

## 2. Reescrever a pagina principal

**Arquivo:** `src/pages/eventos/SindicantesAdmin.tsx` (novo — substitui `EmpresasSindicancia.tsx`)

**Rota:** `/eventos/sindicantes`

### 2.1 Topo
- Breadcrumb: Home > Eventos > Sindicantes
- Titulo: "Sindicantes" / Subtitulo: "Empresas de sindicancia cadastradas"
- Botao "+ Novo Sindicante" no canto direito

### 2.2 Cards de resumo (4)
Queries ao Supabase:
- **Total Cadastrados**: `COUNT(*)` de `empresas_sindicancia`
- **Ativos**: `COUNT(*)` de `empresas_sindicancia WHERE ativo = true`
- **Com Caso em Andamento**: `COUNT(DISTINCT empresa_sindicancia_id)` de `sindicancias WHERE status IN ('atribuido', 'em_andamento')`
- **Sindicancias este Mes**: `COUNT(*)` de `sindicancias WHERE data_abertura >= primeiro dia do mes`

### 2.3 Filtros e busca
- Select de status: Ativo / Inativo / Todos
- Select de especialidade: lista das especialidades
- Campo de busca: filtra por nome fantasia, razao social, CNPJ, nome do responsavel

### 2.4 Tabela
Colunas: Nome Fantasia (clicavel — abre Sheet), CNPJ, Responsavel, Telefone, Especialidades (badges coloridas), Casos Ativos (numero), Status (badge), Acoes (dropdown: Editar, Ativar/Desativar, Ver Casos)

As cores das badges de especialidade:
- Fraude Veicular: vermelho
- Roubo/Furto: laranja
- Incendio: amarelo
- Colisao Suspeita: purple
- Geral: azul

**Query principal:** busca `empresas_sindicancia` com left join count em `sindicancias` para contar casos ativos. Como o Supabase JS nao faz left join count facilmente, faremos 2 queries: uma para empresas e outra para contagem de casos ativos por empresa.

---

## 3. Modal de Cadastro/Edicao

**Dentro do mesmo arquivo** `SindicantesAdmin.tsx` (ou componente separado `NovoSindicanteModal.tsx`).

### 3.1 Secoes do formulario

**Dados da Empresa:** Razao Social*, Nome Fantasia, CNPJ* (com mascara CnpjInput)

**Dados do Responsavel:** Nome Completo*, CPF (CpfInput), Telefone* (TelefoneInput), Email* (Input type=email)

**Configuracao:** Especialidades (checkboxes), Regioes de Atuacao (checkboxes), Valor por Sindicancia (CurrencyInput), Observacoes (Textarea)

### 3.2 Validacoes
- CNPJ unico: query `empresas_sindicancia` antes de salvar
- Email unico: a edge function `create-user` ja valida
- Campos obrigatorios: razao_social, cnpj, responsavel_nome, responsavel_telefone, responsavel_email

### 3.3 Fluxo ao salvar (NOVO)
1. Chamar `create-user` edge function com `{ nome, email, tipo: 'prestador', perfis: ['sindicante'] }`
2. Com o `userId` retornado, buscar o `profile_id` correspondente
3. Inserir em `empresas_sindicancia` com `profile_id` vinculado
4. Toast: "Sindicante cadastrado! Email de acesso enviado para [email]"

### 3.4 Fluxo ao salvar (EDICAO)
- Apenas `UPDATE` em `empresas_sindicancia` (nao recria usuario)
- Se email mudou, avisar que o login nao muda automaticamente

---

## 4. Painel Lateral de Detalhe (Sheet)

**Componente:** `SindicanteDetalheSheet.tsx` (novo)

Abre ao clicar no nome na tabela. Conteudo:

### Card "Dados da Empresa"
- Todos os dados cadastrais exibidos em formato label/valor
- Especialidades e regioes como badges
- Botao "Editar" abre modal de edicao pre-preenchido

### Card "Historico de Sindicancias"
- Query: `sindicancias WHERE empresa_sindicancia_id = X ORDER BY data_abertura DESC LIMIT 10`
- Tabela compacta: Numero, Evento, Data, Conclusao (badge colorida), Dias
- Dias = diferenca entre data_abertura e data_laudo (ou "Em andamento — X dias" se sem laudo)

### Card "Metricas"
- Total de sindicancias realizadas
- Tempo medio de conclusao (em dias) — calcula media de (data_laudo - data_abertura) para casos com laudo
- Distribuicao de resultados: contagem por laudo_conclusao, exibido como mini barras horizontais com % (recharts BarChart ou simples divs com width %)

---

## 5. Atualizar Rotas

**Arquivo:** `src/App.tsx`

- Trocar `/configuracoes/empresas-sindicancia` por `/eventos/sindicantes`
- Importar `SindicantesAdmin` em vez de `EmpresasSindicancia`
- A rota antiga pode ficar como redirect por seguranca

---

## 6. Navegacao

Verificar se o menu lateral ja tem link para sindicantes. Se nao tiver, adicionar em "Eventos" um subitem "Sindicantes" apontando para `/eventos/sindicantes`.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/pages/eventos/SindicantesAdmin.tsx` | Pagina principal com cards, tabela, filtros, modal de cadastro/edicao |
| `src/components/sindicante/SindicanteDetalheSheet.tsx` | Painel lateral com dados, historico e metricas |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/create-user/index.ts` | Adicionar `analista_eventos` aos allowedRoles |
| `src/App.tsx` | Trocar rota de `/configuracoes/empresas-sindicancia` para `/eventos/sindicantes` e importar novo componente |

## Arquivo a Remover (opcional)

| Arquivo | Motivo |
|---|---|
| `src/pages/configuracoes/EmpresasSindicancia.tsx` | Substituido pelo novo `SindicantesAdmin.tsx` |

## Sequencia de Implementacao

1. Atualizar edge function `create-user` (allowedRoles)
2. Criar `SindicantesAdmin.tsx` (pagina completa com cards, tabela, filtros, modal)
3. Criar `SindicanteDetalheSheet.tsx` (painel lateral)
4. Atualizar rotas no `App.tsx`
5. Verificar navegacao no menu lateral
