

# CRUD de Configuracoes na Gestao Comercial: Categorias, Categorias Especiais e Regioes

## Situacao Atual

Existem tres conjuntos de dados que o diretor precisa gerenciar, mas estao espalhados ou hardcoded:

1. **Categorias de Veiculo Aceitas** (passeio, aplicativo, moto, diesel, eletrico, especial_plus, lancamento) — hardcoded em `PlanFormModal.tsx` como `VEHICLE_CATEGORIES`. Usadas no formulario de plano para definir quais tipos de veiculo o plano aceita.

2. **Categorias Especiais / Situacao do Veiculo** (chassi remarcado, placa vermelha, leilao, aplicativo, ex-taxi, etc.) — armazenadas na tabela `configuracoes` com chave `categorias_veiculo`. Usadas na cotacao para identificar a situacao especial do veiculo e aplicar depreciacao.

3. **Regioes** — ja possuem tabela propria (`regioes`) com CRUD completo no hook `useRegioes.ts`, mas o gerenciamento esta no Mapa de Atendimento, sem interface dedicada na Gestao Comercial.

## Plano

### 1. Nova aba "Cadastros" no menu Gestao Comercial

Adicionar ao grupo **Operacao** (ou criar grupo **Cadastros**) um novo item de menu: **"Cadastros Base"**. Essa aba tera 3 sub-abas internas:

- **Categorias de Veiculo** — CRUD das categorias que aparecem no formulario de plano (passeio, moto, diesel...). Salvar na tabela `configuracoes` chave `categorias_veiculo_plano` como JSON array `[{value, label}]`.
- **Categorias Especiais** — CRUD das situacoes especiais do veiculo na cotacao (chassi remarcado, leilao...). Ja usa `configuracoes` chave `categorias_veiculo`.
- **Regioes** — CRUD completo usando a tabela `regioes` existente. Interface com lista, criar, editar, ativar/desativar.

### 2. Migration: nova chave configuracoes

Inserir `categorias_veiculo_plano` na tabela `configuracoes` com o JSON dos valores atuais hardcoded:
```sql
INSERT INTO configuracoes (chave, valor, categoria, descricao)
VALUES ('categorias_veiculo_plano',
  '[{"value":"passeio","label":"Passeio"},{"value":"aplicativo","label":"Aplicativo"},{"value":"moto","label":"Moto"},{"value":"diesel","label":"Diesel"},{"value":"eletrico","label":"Elétrico"},{"value":"especial_plus","label":"Especial Plus"},{"value":"lancamento","label":"Lançamento"}]',
  'operacional',
  'Categorias de veículo aceitas nos planos (usado no formulário de criação de plano)');
```

### 3. Hook `useCategoriasVeiculoPlano`

Novo hook em `useConteudosSistema.ts` que le a chave `categorias_veiculo_plano` do banco com fallback para os valores atuais.

### 4. Componente `CadastrosBase.tsx`

Novo componente com 3 sub-abas (Tabs):

**Sub-aba Categorias de Veiculo:**
- Tabela com colunas: Valor (slug), Label, Acoes (editar/excluir)
- Botao "Adicionar Categoria"
- Dialog simples com campos: valor (slug auto-gerado), label
- Salva via UPDATE na tabela `configuracoes` chave `categorias_veiculo_plano`

**Sub-aba Categorias Especiais:**
- Mesma mecanica, salva na chave `categorias_veiculo`
- Campos: valor, label

**Sub-aba Regioes:**
- Lista de regioes da tabela `regioes` com useRegioes()
- Botao criar, editar (dialog com campos: codigo, nome, descricao, cidades, multiplicador, ativa)
- Toggle ativar/desativar inline
- Botao excluir com confirmacao

### 5. Atualizar PlanFormModal.tsx

Substituir `VEHICLE_CATEGORIES` hardcoded pelo hook `useCategoriasVeiculoPlano()`, tornando as categorias dinamicas.

### 6. Registrar na navegacao

Adicionar item no `TabNavigation.tsx` e renderizar no `GestaoComercial.tsx`.

## Arquivos

| Arquivo | Alteracao |
|---|---|
| Nova migration | INSERT chave `categorias_veiculo_plano` |
| `src/hooks/useConteudosSistema.ts` | Adicionar `useCategoriasVeiculoPlano` |
| `src/components/gestao-comercial/CadastrosBase.tsx` | Novo — CRUD 3 sub-abas |
| `src/components/gestao-comercial/TabNavigation.tsx` | Adicionar item "Cadastros Base" |
| `src/pages/diretoria/GestaoComercial.tsx` | Renderizar CadastrosBase na nova aba |
| `src/components/admin/planos/PlanFormModal.tsx` | Usar hook dinamico em vez de hardcoded |

