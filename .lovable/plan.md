

# Plano: Corrigir Persistencia do Codigo SGA do Vendedor

## Problema Identificado

O codigo SGA do vendedor nao esta sendo salvo porque a politica de RLS (Row Level Security) da tabela `profiles` nao permite que diretores/gerentes atualizem profiles de outros usuarios.

### Evidencias

**Politica atual de UPDATE na tabela `profiles`:**
```sql
"Users can update own profile"
USING (user_id = auth.uid())
```

Esta politica so permite que o usuario atualize **seu proprio** profile. Quando o diretor (user_id: `4218616b...`) tenta atualizar o profile do vendedor (user_id: `41afe82a...`), o UPDATE e silenciosamente rejeitado pelo PostgreSQL.

**Comportamento observado:**
- Request PATCH retorna status 204 (aparenta sucesso)
- Nenhum erro e mostrado na interface
- Dados nao sao persistidos no banco

---

## Solucao

Criar uma nova politica de RLS que permita que usuarios com roles de gerencia possam atualizar profiles de outros usuarios.

### Migracao SQL

Adicionar politica que permite gerencia atualizar qualquer profile:

```sql
-- Politica para permitir que gerencia atualize profiles de consultores
CREATE POLICY "Management can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_gerencia(auth.uid()))
  WITH CHECK (is_gerencia(auth.uid()));
```

A funcao `is_gerencia()` ja existe no sistema e retorna `true` para usuarios com roles:
- `diretor`
- `gerente_comercial`
- `gerente_operacional`
- `desenvolvedor`
- `admin_master`

---

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Nova migracao SQL | **Criar** | Adicionar politica RLS para permitir UPDATE por gerencia |

---

## Comportamento Apos Correcao

1. Diretor acessa tela de Consultores
2. Clica em Editar no consultor desejado
3. Preenche o Codigo SGA Voluntario
4. Clica em Salvar
5. Dados sao persistidos no banco
6. Ao atualizar a pagina, codigo aparece na tabela

---

## Fluxo de Decisao RLS

```text
UPDATE profiles SET codigo_sga_voluntario = '12345' WHERE id = 'vendedor_id'

         │
         ▼
┌─────────────────────────────────┐
│  Verificar politicas UPDATE     │
│  na tabela profiles             │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────────┐    ┌─────────────────────┐
│ Politica 1  │    │ Politica 2 (NOVA)   │
│ user_id =   │ OR │ is_gerencia()       │
│ auth.uid()  │    │ = true              │
└─────┬───────┘    └──────────┬──────────┘
      │                       │
      │ false                 │ true (diretor)
      │                       │
      └───────────┬───────────┘
                  │
                  ▼
          UPDATE permitido!
```

---

## Codigo da Migracao

```sql
-- Permitir que gerencia atualize profiles de funcionarios/consultores
-- Necessario para que diretores possam editar codigo_sga_voluntario

CREATE POLICY "Management can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_gerencia(auth.uid()))
  WITH CHECK (is_gerencia(auth.uid()));

-- Comentario: Esta politica complementa a existente "Users can update own profile"
-- que so permite usuario atualizar seu proprio perfil
```

---

## Validacao

Apos aplicar a migracao:

1. Fazer login como diretor (`admin@teste.com`)
2. Acessar Vendas > Consultores
3. Editar um consultor e preencher codigo SGA
4. Salvar e atualizar a pagina
5. Verificar que o codigo foi persistido

