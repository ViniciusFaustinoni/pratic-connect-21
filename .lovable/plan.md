

# CRUD de Termos e Aditivos com Regras de Anexacao Automatica

## Visao Geral

Criar um sistema completo de gestao de **Termos** (documentos base do contrato de filiacao) e **Aditivos** (documentos complementares anexados automaticamente com base em regras). O sistema substitui a logica atual hardcoded de aditivo 0KM e rastreador por uma abordagem dinamica e configuravel pelo diretor.

## Conceito

```text
TERMO (documento principal)
  |
  +-- ADITIVO 1 (regra: veiculo 0km)         --> anexado automaticamente
  +-- ADITIVO 2 (regra: veiculo blindado)     --> anexado automaticamente
  +-- ADITIVO 3 (regra: FIPE acima de X)      --> anexado automaticamente
  +-- ADITIVO N (manual ou outra regra)        --> anexado manualmente
```

---

## Alteracoes no Banco de Dados

### Nova tabela: `termos_aditivos`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | uuid PK | Identificador |
| `nome` | varchar | Nome do aditivo (ex: "Termo Aditivo 0KM") |
| `descricao` | text | Descricao breve |
| `conteudo_html` | text | Conteudo HTML do aditivo com variaveis {{...}} |
| `ativo` | boolean | Se o aditivo esta ativo |
| `regras` | jsonb | Array de regras de anexacao automatica |
| `ordem` | integer | Ordem de exibicao |
| `created_by` | uuid | Quem criou |
| `created_at` | timestamptz | Data de criacao |
| `updated_at` | timestamptz | Data de atualizacao |

**Formato do campo `regras` (jsonb):**
```json
[
  { "tipo": "veiculo_0km", "ativo": true },
  { "tipo": "veiculo_blindado", "ativo": true },
  { "tipo": "fipe_acima_de", "ativo": true, "valor_config": "aditivo_fipe_limite" }
]
```

Tipos de regra possiveis:
- `veiculo_0km` -- detectado automaticamente pelo CRLV (sem placa / procedencia "Novo (zero km)")
- `veiculo_blindado` -- detectado automaticamente pelo CRLV (campo "observacoes" ou "categoria" do documento)
- `fipe_acima_de` -- valor configuravel na tabela `configuracoes`

### Nova configuracao: `aditivo_fipe_limite`

Inserir na tabela `configuracoes`:

| chave | valor | tipo | categoria | descricao | editavel |
|-------|-------|------|-----------|-----------|----------|
| `aditivo_fipe_limite` | `100000` | `moeda` | `operacional` | Valor FIPE a partir do qual aditivos com regra "fipe_acima_de" sao anexados automaticamente | true |

### RLS

- SELECT: usuarios autenticados
- INSERT/UPDATE/DELETE: apenas perfis `diretor` e `admin`

---

## Frontend

### 1. Nova pagina: CRUD de Aditivos (`/documentos/aditivos`)

**Localizacao no menu:** Dentro do modulo **Documentos** existente (ao lado de "Templates").

**Listagem:**
- Tabela com colunas: Nome, Regras ativas (badges), Status (ativo/inativo), Acoes
- Botao "Novo Aditivo"
- Filtro por status

**Formulario (criar/editar):**
- Campo: Nome (text)
- Campo: Descricao (textarea)
- Campo: Conteudo HTML (editor de texto rico, mesmo padrao dos templates existentes, com suporte a variaveis {{...}})
- Secao "Regras de Anexacao Automatica":
  - Checkbox: "Veiculo 0KM" -- Identificado automaticamente via CRLV
  - Checkbox: "Veiculo Blindado" -- Identificado automaticamente via CRLV
  - Checkbox: "Valor FIPE acima de" -- Com indicacao do valor atual configurado e link para configuracoes
- Toggle: Ativo/Inativo
- Campo: Ordem (numero)

### 2. Configuracao do limite FIPE (`/diretoria/configuracoes`)

Adicionar o campo `aditivo_fipe_limite` na pagina de configuracoes do diretor (ja existe infraestrutura para isso na tabela `configuracoes`). O diretor pode editar o valor diretamente.

### 3. Atualizacao da pagina GerarTermo (`/cadastro/gerar-termo`)

Substituir a logica hardcoded atual por uma logica dinamica:

- Buscar todos os aditivos ativos da tabela `termos_aditivos`
- Para cada aditivo, avaliar suas regras contra os dados do veiculo/contrato:
  - `veiculo_0km`: verificar se placa vazia ou procedencia "Novo (zero km)"
  - `veiculo_blindado`: verificar campo de blindagem do veiculo (a ser mapeado do CRLV)
  - `fipe_acima_de`: comparar valor FIPE do veiculo com o valor da configuracao `aditivo_fipe_limite`
- Exibir checkboxes automaticamente marcados para aditivos cujas regras batem
- Permitir que o usuario marque/desmarque aditivos manualmente
- Na geracao do PDF e envio ao Autentique, incluir o HTML dos aditivos selecionados

### 4. Template do Termo (TermoFiliacaoTemplate)

Atualizar o componente para receber uma lista dinamica de aditivos (em vez dos booleans `incluirTermo0km` e `incluirTermoRastreador`), renderizando cada aditivo como uma secao adicional no documento.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/documentos/Aditivos.tsx` | Pagina de listagem do CRUD de aditivos |
| `src/pages/documentos/AditivoForm.tsx` | Formulario de criacao/edicao de aditivo |
| `src/hooks/useAditivos.ts` | Hook com queries e mutations para termos_aditivos |
| `src/hooks/useAvaliarAditivos.ts` | Hook que avalia quais aditivos se aplicam a um veiculo/contrato |
| Migration SQL | Criar tabela `termos_aditivos`, inserir config `aditivo_fipe_limite`, RLS |

## Arquivos a Alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rotas `/documentos/aditivos` e `/documentos/aditivos/:id` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Aditivos" no menu Documentos |
| `src/pages/cadastro/GerarTermo.tsx` | Substituir logica hardcoded por avaliacao dinamica de aditivos |
| `src/components/cadastro/TermoFiliacaoTemplate.tsx` | Receber lista de aditivos dinamicos em vez de booleans |

## O que NAO muda

- Templates de documentos existentes (documento_templates) -- continuam funcionando normalmente
- Document Types existentes -- nao sao afetados
- Edge functions de geracao de PDF/Autentique -- serao adaptadas apenas para incluir os aditivos dinamicos
- Logica de OCR do CRLV -- apenas o resultado sera usado para avaliar regras

