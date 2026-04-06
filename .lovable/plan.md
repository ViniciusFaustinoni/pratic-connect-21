

# Plano: Corrigir erro ao criar/salvar plano na Gestão Comercial

## Diagnóstico

O erro ocorre no componente `PlanoFormSheet.tsx` (usado na rota Diretoria > Gestão Comercial). A tabela `planos` tem **duas constraints UNIQUE** em `codigo` e `slug`. O código atual gera ambos de forma idêntica a partir do nome do plano (line 161):

```
const codigo = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
```

Se já existir um plano com o mesmo `codigo` ou `slug`, o INSERT falha com erro de constraint violation, exibindo apenas "Erro ao salvar plano" sem detalhes.

## Solução

### 1. Gerar `codigo` único com sufixo incremental (`PlanoFormSheet.tsx`)
- Antes do insert, verificar se o `codigo` gerado já existe na tabela `planos`.
- Se existir, adicionar sufixo numérico incrementando (`-2`, `-3`, etc.) até encontrar um valor disponível.
- Usar o mesmo valor para `slug`.

### 2. Melhorar mensagem de erro
- No `onError` da mutation, exibir a mensagem real do erro (`e.message`) em vez do genérico "Erro ao salvar plano", para facilitar diagnóstico de outros problemas futuros.

### 3. Validação de nome vazio
- Já existe `disabled={!nome.trim()}` no botão, mas adicionar validação explícita no início da mutation para segurança.

## Arquivo modificado
- `src/components/gestao-comercial/PlanoFormSheet.tsx` — gerar codigo/slug único + melhorar mensagem de erro

