

# Revisao: Cadastro dos 3 Tipos de Fornecedores

## Resultado da Verificacao Completa

### 1. Tres Tipos de Fornecedores

| Tipo | Existe | Pagina | Hook | Form | Drawer | Menu |
|---|---|---|---|---|---|---|
| Oficinas | OK | Oficinas.tsx | useOficinas.ts | OficinaFormDialog | OficinaDetailDrawer | OK |
| Auto Centers | OK | AutoCenters.tsx | useAutoCenters.ts | AutoCenterFormDialog | AutoCenterDetailDrawer | OK |
| Prestadores | OK | Prestadores.tsx | usePrestadoresEvento.ts | PrestadorFormDialog | PrestadorDetailDrawer | OK |

### 2. Marcas Atendidas

| Item | Oficinas | Auto Centers | Prestadores |
|---|---|---|---|
| Selecao multipla no form | OK | OK | OK |
| Lista completa (31 marcas) | OK | OK | OK |
| Opcao GLOBAL | OK | OK | OK |
| GLOBAL desabilita individuais | OK | OK | OK |
| Badges na listagem | OK | OK | OK |
| **Filtro por marca na listagem** | OK | OK | **FALTANDO** |

### 3. Especialidades

| Item | Oficinas | Auto Centers | Prestadores |
|---|---|---|---|
| Selecao multipla no form | OK | OK | OK |
| Lista completa (16 itens) | OK | OK | OK |
| Badges na listagem | OK | OK | OK |
| **Filtro por especialidade na listagem** | **FALTANDO** | **FALTANDO** | OK |

### 4. Dados Basicos

| Campo | Oficinas | Auto Centers | Prestadores |
|---|---|---|---|
| Razao Social | OK | OK | OK |
| Nome Fantasia | OK | OK (form) | OK |
| CNPJ | OK | OK | OK |
| **Inscricao Estadual** | OK | **FALTANDO** (form+DB) | **FALTANDO** (form+DB) |
| Telefone | OK | OK (contato_telefone) | OK |
| WhatsApp | OK | OK (obrigatorio) | OK |
| Email | OK | OK | OK |
| CEP, logradouro, numero, complemento, bairro, cidade, estado | OK | OK | OK |
| Banco, agencia, conta, PIX | OK | OK | OK |
| Status (ativo/inativo/suspenso) | OK | **NAO GERENCIADO** (coluna existe no DB mas nao no form/listagem) | OK |

### 5. Menus de Navegacao
- OK: 3 submenus na secao Oficinas

### 6. Formularios
- Criar e editar funcionam nos 3 tipos
- Marcas e especialidades sao salvos corretamente

---

## 6 Correcoes Necessarias

### Correcao 1 — Adicionar filtro de especialidade na listagem de Oficinas

**Arquivo:** `src/pages/oficinas/Oficinas.tsx`

Adicionar state `espFilter` e um Select com as especialidades (igual ao que ja existe em Prestadores). Passar `especialidade` para o hook `useOficinas`.

### Correcao 2 — Adicionar filtro de especialidade na listagem de Auto Centers

**Arquivo:** `src/pages/oficinas/AutoCenters.tsx`

Adicionar state `espFilter` e Select com especialidades. Passar para `useAutoCenters`. O hook ja suporta o parametro `especialidade`.

### Correcao 3 — Adicionar filtro de marca na listagem de Prestadores

**Arquivo:** `src/pages/oficinas/Prestadores.tsx`

Adicionar state `marcaFilter` e Select com marcas de veiculos. Passar para `usePrestadoresEvento`. O hook ja suporta o parametro `marca`.

### Correcao 4 — Adicionar campo Inscricao Estadual no form de Auto Centers

**Migracao SQL:** Adicionar coluna `inscricao_estadual text` na tabela `auto_centers`.

**Arquivo:** `src/components/oficinas/AutoCenterFormDialog.tsx` — adicionar campo `inscricao_estadual` no schema zod e no formulario (ao lado do CNPJ).

### Correcao 5 — Adicionar campo Inscricao Estadual no form de Prestadores

**Migracao SQL:** Adicionar coluna `inscricao_estadual text` na tabela `prestadores_evento`.

**Arquivo:** `src/components/oficinas/PrestadorFormDialog.tsx` — adicionar campo `inscricao_estadual` no schema zod e no formulario.

### Correcao 6 — Gerenciar status no Auto Center (form + listagem)

**Arquivo:** `src/components/oficinas/AutoCenterFormDialog.tsx` — adicionar campo Select de status (ativo/inativo/suspenso) e enviar no payload.

**Arquivo:** `src/pages/oficinas/AutoCenters.tsx` — exibir badge de status nos cards (como Oficinas e Prestadores ja fazem). Adicionar filtro de status.

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Migracao | Adicionar `inscricao_estadual text` em `auto_centers` e `prestadores_evento` |
| Modificar | `src/pages/oficinas/Oficinas.tsx` — adicionar filtro especialidade |
| Modificar | `src/pages/oficinas/AutoCenters.tsx` — adicionar filtro especialidade + status badges/filtro |
| Modificar | `src/pages/oficinas/Prestadores.tsx` — adicionar filtro marca |
| Modificar | `src/components/oficinas/AutoCenterFormDialog.tsx` — adicionar inscricao_estadual + status |
| Modificar | `src/components/oficinas/PrestadorFormDialog.tsx` — adicionar inscricao_estadual |

