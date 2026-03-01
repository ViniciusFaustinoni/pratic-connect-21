

# Correcao do Duplo Check e Botao Ligar

## Problemas Identificados

### 1. Duplo Check falha: valor de enum invalido
O codigo tenta atualizar o status para `'nao_compareceu'`, mas esse valor **nao existe** no enum `status_servico`. Os valores validos sao: `pendente`, `agendada`, `em_rota`, `em_andamento`, `concluida`, `aprovada`, `reprovada`, `aprovada_ressalvas`, `em_analise`, `reagendada`, `cancelada`.

O Supabase rejeita o UPDATE silenciosamente (ou com erro) porque o valor viola a constraint do enum.

### 2. Botao Ligar abre seletor de apps
O codigo usa `window.open('tel:...', '_self')` que no Android abre um dialog perguntando qual app usar (Chrome, Contatos, WhatsApp). Para ir direto para o discador, deve-se usar `window.location.href = 'tel:...'`.

## Solucao

### Alteracao 1: Migracao SQL - Adicionar valor ao enum
Adicionar `nao_compareceu` ao enum `status_servico` para que o status seja valido.

```sql
ALTER TYPE status_servico ADD VALUE IF NOT EXISTS 'nao_compareceu';
```

### Alteracao 2: Corrigir botao Ligar em `DuploCheckImprevisto.tsx`
Trocar `window.open('tel:...')` por `window.location.href = 'tel:...'` para abrir o discador diretamente sem o seletor de apps do Android. Tambem limpar o numero antes de usar no `tel:`.

### Arquivos alterados
- 1 migracao SQL (adicionar enum value)
- `src/components/vistoriador/DuploCheckImprevisto.tsx` (corrigir ligacao)

