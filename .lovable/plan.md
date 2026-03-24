

# Suporte a Vistoriador Prestador — Dados e Serviço de Consulta

## Contexto

Hoje, vistoriadores são usuários do sistema (tabela `profiles` com role `instalador_vistoriador`). O novo tipo "prestador" **não tem login**, portanto precisa de uma estrutura separada.

## Alterações

### 1. Migration SQL — Novas tabelas e enum

**Tabela `vistoriadores_prestadores`** — cadastro dos prestadores de vistoria (sem login):

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | Identificador |
| nome | text NOT NULL | Nome completo |
| telefone | text | Telefone/WhatsApp |
| email | text | Email de contato |
| cpf_cnpj | text | CPF ou CNPJ |
| ativo | boolean DEFAULT true | Se está ativo |
| observacoes | text | Notas internas |
| created_at / updated_at | timestamptz | Timestamps |

**Tabela `vistoriador_cidades`** — vínculo cidade ↔ vistoriador (ambos os tipos):

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | Identificador |
| cidade | text NOT NULL | Nome do município |
| uf | text NOT NULL | Estado (2 chars) |
| tipo_vistoriador | enum `tipo_vistoriador` ('comum', 'prestador') | Tipo |
| vistoriador_comum_id | uuid FK → profiles(id) | Preenchido se tipo = comum |
| vistoriador_prestador_id | uuid FK → vistoriadores_prestadores(id) | Preenchido se tipo = prestador |
| created_at | timestamptz | Timestamp |

Constraint CHECK: exatamente um dos dois IDs preenchido conforme o tipo.

**Função SQL `buscar_cobertura_vistoria(p_cidade text, p_uf text)`** — retorna JSON com:
- `tem_comum: boolean` + lista de vistoriadores comuns
- `tem_prestador: boolean` + lista de vistoriadores prestadores  
- `fora_de_cobertura: boolean`

**RLS**: Leitura para autenticados; escrita restrita a `coordenador_monitoramento`, `admin`, `diretor`.

### 2. Hook frontend — `useCoberturaCidade.ts`

Hook que chama a função RPC `buscar_cobertura_vistoria` com município/UF e retorna o resultado tipado. Será consumido por telas futuras da série VP.

### 3. Hook frontend — `useVistoriadoresPrestadores.ts`

CRUD básico para a tabela `vistoriadores_prestadores` (listar, criar, editar, ativar/desativar).

### 4. Hook frontend — `useVistoriadorCidades.ts`

CRUD para vínculos cidade ↔ vistoriador na tabela `vistoriador_cidades`.

### Arquivos novos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/xxx.sql` | Enum, tabelas, função RPC, RLS |
| `src/hooks/useVistoriadoresPrestadores.ts` | CRUD prestadores |
| `src/hooks/useVistoriadorCidades.ts` | CRUD vínculos cidade |
| `src/hooks/useCoberturaCidade.ts` | Consulta de cobertura |

### Sem alteração

- Fluxo de atribuição de vistoriadores comuns (inalterado)
- Tabela `profiles` (sem nova coluna — tipo "comum" é implícito pelo role)
- Nenhuma tela nova (conforme solicitado)

