

# Plano: Permitir Leitura Pública das Configurações da Base

## Problema Identificado

A tabela `configuracoes` tem RLS (Row Level Security) ativado com políticas que só permitem acesso a usuários autenticados como funcionários ou gerência:

| Política | Comando | Condição |
|----------|---------|----------|
| `config_all_gerencia` | ALL | `is_gerencia(auth.uid())` |
| `config_select_funcionario` | SELECT | `is_funcionario(auth.uid())` |

O cliente que acessa o fluxo de contratação pública **não está autenticado**, portanto não consegue ler as configurações da base (horários, endereço), resultando em um array vazio de slots de horário.

## Solução

Adicionar uma política de RLS que permita leitura pública **apenas das chaves relacionadas à base** (endereço e horários de funcionamento).

## Implementação

### Migração SQL

Criar uma nova política que permite SELECT anônimo apenas para as chaves `base_*`:

```sql
CREATE POLICY "config_base_public_read" 
ON public.configuracoes 
FOR SELECT 
TO anon
USING (
  chave IN (
    'base_cep', 
    'base_logradouro', 
    'base_numero',
    'base_bairro', 
    'base_cidade', 
    'base_uf', 
    'base_complemento',
    'base_horario_inicio', 
    'base_horario_fim', 
    'base_capacidade_horario'
  )
);
```

### Fluxo de Dados

```text
ANTES:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente Público │────►│ useConfiguracaoBase│───►│ configuracoes  │
│ (não logado)    │     │ (SELECT)        │     │ ⛔ RLS BLOQUEIA │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                               data = [] ❌

DEPOIS:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente Público │────►│ useConfiguracaoBase│───►│ configuracoes  │
│ (role: anon)    │     │ (SELECT base_*) │     │ ✅ NOVA POLICY  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                               data = [
                                                 base_horario_inicio: 08:00,
                                                 base_horario_fim: 17:30,
                                                 ...
                                               ] ✅
```

## Segurança

A nova política é segura porque:

1. **Apenas leitura (SELECT)** - não permite inserção, atualização ou exclusão
2. **Escopo limitado** - apenas as 10 chaves `base_*` são expostas
3. **Dados não sensíveis** - endereço e horários de funcionamento são informações públicas

Outras configurações do sistema (chaves de API, configurações internas, etc.) continuam protegidas.

## Alterações

| Tipo | Descrição |
|------|-----------|
| Migração SQL | Adicionar política `config_base_public_read` para leitura anônima das chaves `base_*` |

## Resultado Esperado

Após a migração:

1. Cliente acessa página de agendamento na base
2. Hook `useConfiguracaoBase` faz SELECT das configurações
3. RLS permite leitura das chaves `base_*` para usuário anônimo
4. Horários 08:00 - 17:30 são retornados corretamente
5. Slots de horário são gerados e exibidos ao cliente

