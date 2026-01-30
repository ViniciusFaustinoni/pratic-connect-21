
# Correção: Tratamento de Erro no Formulário de Criação de Conta

## Diagnóstico

O erro "Erro de conexão. Tente novamente." é exibido incorretamente quando a Edge Function retorna um erro HTTP 400 (como "email já em uso").

### Causa Raiz

No `CriarContaAssociadoForm.tsx`, o código trata **qualquer erro HTTP** como "Erro de conexão":

```typescript
if (error) {
  throw new Error('Erro de conexão. Tente novamente.');  // Ignora a mensagem real!
}
```

Quando o Supabase SDK recebe uma resposta não-2xx, ele popula tanto `error` quanto `data`. O `data` contém o body da resposta (com a mensagem de erro real), mas o código atual ignora isso.

### Evidência

Teste da Edge Function retornou:
```json
{"success": false, "error": "Este email já está em uso. Escolha outro email."}
```

Isso porque o email `marcosdativo@gmail.com` já existe na tabela `profiles` vinculado a outro usuário (tipo `funcionario`).

## Solução

Modificar o tratamento de erro para:
1. Primeiro verificar se `data` existe e contém um erro (resposta estruturada da Edge Function)
2. Só então verificar o `error` do SDK para erros de rede/conexão reais

## Alterações

### Arquivo: `src/components/public/CriarContaAssociadoForm.tsx`

```typescript
// ANTES (incorreto)
const { data, error } = await supabase.functions.invoke('app-criar-conta-cliente', {
  body: { associadoId, email: emailFinal.toLowerCase().trim(), senha }
});

if (error) {
  console.error('Erro HTTP da Edge Function:', error);
  throw new Error('Erro de conexão. Tente novamente.');
}

if (!data?.success) {
  throw new Error(data?.error || 'Erro ao criar conta');
}

// DEPOIS (correto)
const { data, error } = await supabase.functions.invoke('app-criar-conta-cliente', {
  body: { associadoId, email: emailFinal.toLowerCase().trim(), senha }
});

// O Supabase SDK coloca respostas não-2xx no error, mas o body ainda vem em data
// Primeiro verificar se temos uma resposta estruturada da Edge Function
if (data && !data.success) {
  throw new Error(data.error || 'Erro ao criar conta');
}

// Se não temos data válido mas temos error, é erro de conexão/rede
if (error && !data) {
  console.error('Erro de conexão com Edge Function:', error);
  throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
}

// Se nem data.success existe, algo deu errado
if (!data?.success) {
  throw new Error('Resposta inválida do servidor. Tente novamente.');
}
```

## Resultado Esperado

Após a correção:
- Se o email já estiver em uso: exibirá "Este email já está em uso. Escolha outro email."
- Se o associado já tiver conta: exibirá "Você já possui uma conta. Use 'Esqueci minha senha' se necessário."
- Se houver erro de rede real: exibirá "Erro de conexão. Verifique sua internet."

## Sobre o Caso Específico

O cliente MARCOS VINICIUS DATIVO MACHADO está tentando criar conta com o email `marcosdativo@gmail.com`, mas esse email já está cadastrado no sistema para outro usuário (tipo funcionário). 

Opções para resolver:
1. **Usar outro email** para o associado
2. **Atualizar o email** do funcionário existente para liberar este email
3. **Verificar se é o mesmo usuário** e fazer a vinculação manualmente
