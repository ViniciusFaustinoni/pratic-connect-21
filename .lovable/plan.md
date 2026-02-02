
# Plano: Corrigir Criação de Conta quando Há Profile Órfão

## Problema Identificado

O associado **MARCUS VINICIUS FAUSTINONI DE FREITAS** não consegue criar conta porque:

1. **Já existe um user no Auth** (`6f834291-b3c8-44e6-a96d-3c7a79fb50b5`) com email `viniciusfaustinoni@gmail.com`
2. **Já existe um profile** vinculado a esse user_id
3. **Porém, nenhum associado está vinculado** a esse user_id (profile órfão)
4. O associado atual (`640c05f6-5465-4cf6-ab71-4471ea143797`) tem `user_id = NULL`
5. A Edge Function retorna: "Este email já está em uso"

### Causa Raiz

O associado original foi **excluído** (provavelmente pelo diretor durante testes), mas a exclusão **não removeu o profile e o usuário Auth** correspondentes.

A Edge Function `delete-associado` deveria ter removido esses registros, mas parece que houve uma falha nesse processo.

---

## Soluções

### Solução Imediata (para este caso específico)

Executar SQL para vincular o `user_id` existente ao novo associado:

```sql
-- Vincular o user_id existente ao associado atual
UPDATE associados 
SET user_id = '6f834291-b3c8-44e6-a96d-3c7a79fb50b5'
WHERE id = '640c05f6-5465-4cf6-ab71-4471ea143797';
```

Após isso, o associado poderá fazer login normalmente com email `viniciusfaustinoni@gmail.com` e a senha definida anteriormente.

Se ele não lembrar a senha, pode usar "Esqueci minha senha" na tela de login.

---

### Solução Sistêmica (prevenir recorrência)

Modificar a Edge Function `app-criar-conta-cliente` para tratar o cenário de **profile órfão**:

**Antes (atual):**
```typescript
// Verificar se email já está em uso
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', emailNormalizado)
  .maybeSingle();

if (existingProfile) {
  return new Response(
    JSON.stringify({ success: false, error: 'Este email já está em uso.' }),
    { status: 400 }
  );
}
```

**Depois (corrigido):**
```typescript
// Verificar se email já está em uso
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('id, user_id')
  .eq('email', emailNormalizado)
  .maybeSingle();

if (existingProfile) {
  // Verificar se esse profile está vinculado a algum associado ativo
  const { data: associadoExistente } = await supabase
    .from('associados')
    .select('id, status')
    .eq('user_id', existingProfile.user_id)
    .maybeSingle();
  
  // Se o profile NÃO tem associado vinculado (profile órfão)
  // E estamos tentando criar conta para um associado ativo
  if (!associadoExistente) {
    // Vincular o user_id existente ao associado atual
    await supabase
      .from('associados')
      .update({ user_id: existingProfile.user_id })
      .eq('id', associadoId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sua conta já existe! Use a senha cadastrada anteriormente ou recupere-a.',
        existingAccount: true
      }),
      { status: 200 }
    );
  }
  
  // Se o profile TEM associado vinculado, é duplicidade real
  return new Response(
    JSON.stringify({ success: false, error: 'Este email já está em uso.' }),
    { status: 400 }
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/app-criar-conta-cliente/index.ts` | **MODIFICAR** | Detectar profiles órfãos e revinculá-los |

---

## Fluxo Corrigido

```text
Cliente tenta criar conta
     │
     ├─► Verificar se email já existe em profiles
     │        │
     │        ├─► SIM, existe profile
     │        │        │
     │        │        ├─► Verificar se tem associado vinculado
     │        │        │        │
     │        │        │        ├─► NÃO tem associado (órfão)
     │        │        │        │        → Vincular user_id ao associado atual
     │        │        │        │        → Retornar "conta já existe, use senha anterior"
     │        │        │        │
     │        │        │        └─► SIM, tem associado ativo
     │        │        │                 → Erro: "email já está em uso"
     │        │        │
     │        └─► NÃO existe profile
     │                 → Criar nova conta normalmente
```

---

## Benefícios

1. **Resolve o problema atual** do MARCUS VINICIUS
2. **Previne recorrências** em casos futuros de exclusão/recriação de associados
3. **Mantém integridade** dos dados de autenticação
4. **Melhora experiência** do usuário com mensagem mais clara

---

## Dados do Caso Atual

- **Associado atual**: `640c05f6-5465-4cf6-ab71-4471ea143797` (user_id = NULL)
- **User existente**: `6f834291-b3c8-44e6-a96d-3c7a79fb50b5`
- **Email**: `viniciusfaustinoni@gmail.com`
- **CPF**: `12493649737`
