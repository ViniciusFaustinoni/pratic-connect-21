

# Adicionar CRUD de Tipos de Uso em Cadastros Base

## Contexto

Hoje os tipos de uso (particular, aplicativo, comercial, moto) estao hardcoded em `src/types/cotacao.ts` como `TipoUso` e `TIPO_USO_LABELS`. O diretor nao consegue gerenciar esses valores. A estrutura de Cadastros Base ja existe com 3 sub-abas — basta adicionar uma 4a aba "Tipos de Uso".

## Plano

### 1. Migration: inserir chave `tipos_uso` na tabela `configuracoes`
```sql
INSERT INTO configuracoes (chave, valor, categoria, descricao)
VALUES ('tipos_uso',
  '[{"value":"particular","label":"Particular"},{"value":"aplicativo","label":"Aplicativo (Uber, 99, etc)"},{"value":"comercial","label":"Comercial"},{"value":"moto","label":"Moto"}]',
  'operacional',
  'Tipos de uso do veículo (usado em planos e cotações)');
```

### 2. Hook `useTiposUso` em `useConteudosSistema.ts`
Mesmo padrao de `useCategoriasVeiculoPlano`: le a chave `tipos_uso` do banco com fallback para os valores atuais hardcoded.

### 3. Novo componente `TiposUsoTab.tsx`
Mesmo padrao de `CategoriasVeiculoTab.tsx`: tabela com slug + nome, botoes adicionar/editar/excluir, dialog com campos nome e slug.

### 4. Atualizar `CadastrosBase.tsx`
Adicionar 4a sub-aba "Tipos de Uso" renderizando `TiposUsoTab`.

### 5. Atualizar `sectionBanners` em `GestaoComercial.tsx`
Atualizar o help text do banner de Cadastros Base para incluir "tipos de uso".

| Arquivo | Alteracao |
|---|---|
| Nova migration | INSERT chave `tipos_uso` |
| `src/hooks/useConteudosSistema.ts` | Adicionar `useTiposUso` + `useSaveTiposUso` |
| `src/components/gestao-comercial/cadastros/TiposUsoTab.tsx` | Novo — CRUD tipos de uso |
| `src/components/gestao-comercial/CadastrosBase.tsx` | Adicionar aba Tipos de Uso |
| `src/pages/diretoria/GestaoComercial.tsx` | Atualizar help text do banner |

