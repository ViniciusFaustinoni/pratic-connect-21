

# Plano: Dados Bancários Editáveis pela Agência

## Problema

A tabela `profiles` não tem campos para dados bancários (banco, agencia, conta, pix). A agência não tem como informar ou atualizar seus dados para pagamento.

## Solução

### 1. Migration — Adicionar campos bancários na tabela `profiles`

```sql
ALTER TABLE public.profiles
  ADD COLUMN banco TEXT,
  ADD COLUMN agencia_bancaria TEXT,
  ADD COLUMN conta_bancaria TEXT,
  ADD COLUMN tipo_conta TEXT,
  ADD COLUMN pix_tipo TEXT,
  ADD COLUMN pix_chave TEXT;
```

Campos nullable, sem impacto em dados existentes. Nome `agencia_bancaria` para não conflitar com o campo conceitual "agência" do sistema.

### 2. Rota `/agencia/dados-pagamento` — Página de edição

Nova página `src/pages/agencia/DadosPagamento.tsx` com formulário para:
- Banco (nome)
- Agência bancária
- Conta bancária
- Tipo de conta (Corrente / Poupança)
- Tipo de chave Pix (CPF/CNPJ, Email, Telefone, Aleatória)
- Chave Pix

Carrega dados do `profiles` do usuário logado, salva via `supabase.from('profiles').update(...)`.

### 3. Navegação no `AgenciaLayout`

Adicionar link/tab no header para "Dados de Pagamento" ao lado do painel principal, permitindo a agência navegar entre a Conta Corrente e seus dados bancários.

### 4. Rota em `App.tsx`

Adicionar rota filha dentro do `AgenciaLayout`:
```
<Route path="/agencia/dados-pagamento" element={<DadosPagamento />} />
```

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar 6 colunas bancárias em `profiles` |
| `src/pages/agencia/DadosPagamento.tsx` | **Novo** — formulário de dados bancários |
| `src/components/layout/AgenciaLayout.tsx` | Navegação para dados de pagamento |
| `src/App.tsx` | Nova rota `/agencia/dados-pagamento` |

