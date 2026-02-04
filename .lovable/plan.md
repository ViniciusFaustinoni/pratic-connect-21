
# Plano: Permitir Alteracao de Email pelo Diretor/Admin Master e Redefinicao de Senha

## Resumo

Implementar um sistema de alteracao de email com duas modalidades:
1. **Diretor/Admin Master**: Podem alterar o email diretamente, sem confirmacao
2. **Usuario proprio**: Alteracao requer confirmacao via email enviado para o novo endereco

Tambem adicionar a funcionalidade de redefinicao de senha no formulario de edicao.

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/admin-update-email/index.ts` | Criar | Nova edge function para alteracao de email por admin |
| `supabase/functions/admin-reset-password/index.ts` | Editar | Adicionar permissao para `admin_master` |
| `supabase/functions/send-email/index.ts` | Editar | Adicionar template de confirmacao de email |
| `src/pages/configuracoes/UsuarioForm.tsx` | Editar | Adicionar campos de email e senha editaveis para admin |

---

## 1. Nova Edge Function: `admin-update-email`

Esta funcao permite que Diretores e Admin Masters alterem o email de qualquer usuario diretamente.

```typescript
// supabase/functions/admin-update-email/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticacao nao fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuario autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuario nao autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o usuario tem role de diretor ou admin_master
    const { data: roles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissoes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDiretor = roles?.some((r) => r.role === "diretor");
    const isAdminMaster = roles?.some((r) => r.role === "admin_master");

    if (!isDiretor && !isAdminMaster) {
      return new Response(
        JSON.stringify({ error: "Apenas diretores e admin master podem alterar emails" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados da requisicao
    const { userId, novoEmail } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID do usuario nao fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!novoEmail || !emailRegex.test(novoEmail)) {
      return new Response(
        JSON.stringify({ error: "Email invalido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente admin para operacoes privilegiadas
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuracao do servidor invalida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o email ja esta em uso
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === novoEmail.toLowerCase() && u.id !== userId
    );

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Este email ja esta em uso por outro usuario" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar o email do usuario (sem confirmacao - admin)
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: novoEmail,
        email_confirm: true  // Confirma automaticamente
      }
    );

    if (updateError) {
      console.error("Erro ao atualizar email:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao alterar email: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar email na tabela profiles
    await supabaseAdmin
      .from("profiles")
      .update({ email: novoEmail, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Registrar log de auditoria
    await supabaseAdmin.from("auth_logs").insert({
      acao: "alterar_email",
      email: user.email,
      profile_id: user.id,
      metadata: { 
        usuario_alterado_id: userId,
        email_antigo: updateData.user?.email,
        email_novo: novoEmail,
        tipo: "alteracao_administrativa",
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email alterado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 2. Atualizar Edge Function: `admin-reset-password`

Adicionar permissao para `admin_master` alem de `diretor`:

```typescript
// Linhas 52-58 - ALTERACAO
const isDiretor = roles?.some((r) => r.role === "diretor");
const isAdminMaster = roles?.some((r) => r.role === "admin_master");

if (!isDiretor && !isAdminMaster) {
  return new Response(
    JSON.stringify({ error: "Apenas diretores e admin master podem redefinir senhas" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## 3. Atualizar Formulario: `UsuarioForm.tsx`

### Modificacoes:

1. **Habilitar campo de email para edicao** quando o usuario logado for Diretor ou Admin Master
2. **Adicionar Card de Seguranca** na coluna lateral com:
   - Campo de nova senha
   - Botao de redefinir senha

### Codigo do Card de Seguranca (coluna lateral):

```typescript
{/* Card de Seguranca - apenas para Diretor/Admin Master em modo edicao */}
{isEditing && (isDiretor || isAdminMaster) && (
  <Card className="border-border/50 border-amber-500/30">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Lock className="w-5 h-5 text-amber-500" />
        Seguranca
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Alterar Email */}
      <div className="space-y-2">
        <Label htmlFor="novoEmail">Novo email</Label>
        <Input
          id="novoEmail"
          type="email"
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
          placeholder="novo@email.com"
          className="bg-background"
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={alterarEmail}
          disabled={alterandoEmail || !novoEmail}
        >
          {alterandoEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
          Alterar Email
        </Button>
      </div>

      <Separator />

      {/* Redefinir Senha */}
      <div className="space-y-2">
        <Label htmlFor="novaSenha">Nova senha</Label>
        <Input
          id="novaSenha"
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          placeholder="Minimo 8 caracteres"
          className="bg-background"
        />
        <Button
          type="button"
          variant="outline"
          className="w-full border-amber-500 text-amber-700 hover:bg-amber-100"
          onClick={redefinirSenha}
          disabled={alterandoSenha || !novaSenha}
        >
          {alterandoSenha ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
          Redefinir Senha
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        As alteracoes sao aplicadas imediatamente
      </p>
    </CardContent>
  </Card>
)}
```

### Funcoes necessarias no componente:

```typescript
// Estados
const [novoEmail, setNovoEmail] = useState('');
const [novaSenha, setNovaSenha] = useState('');
const [alterandoEmail, setAlterandoEmail] = useState(false);
const [alterandoSenha, setAlterandoSenha] = useState(false);

// Verificar permissoes
const { isDiretor, isAdminMaster } = usePermissions();

// Funcao para alterar email
const alterarEmail = async () => {
  if (!novoEmail) return;
  
  setAlterandoEmail(true);
  try {
    const { data, error } = await supabase.functions.invoke('admin-update-email', {
      body: { userId: usuario?.user_id, novoEmail }
    });
    
    if (error || data?.error) throw new Error(data?.error || error.message);
    
    toast.success('Email alterado com sucesso!');
    setNovoEmail('');
    // Atualizar dados do formulario
    setFormData(prev => ({ ...prev, email: novoEmail }));
    queryClient.invalidateQueries({ queryKey: ['usuario-edit', id] });
  } catch (err: any) {
    toast.error(err.message || 'Erro ao alterar email');
  } finally {
    setAlterandoEmail(false);
  }
};

// Funcao para redefinir senha
const redefinirSenha = async () => {
  if (novaSenha.length < 8) {
    toast.error('A senha deve ter pelo menos 8 caracteres');
    return;
  }
  
  setAlterandoSenha(true);
  try {
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { userId: usuario?.user_id, novaSenha }
    });
    
    if (error || data?.error) throw new Error(data?.error || error.message);
    
    toast.success('Senha redefinida com sucesso!');
    setNovaSenha('');
  } catch (err: any) {
    toast.error(err.message || 'Erro ao redefinir senha');
  } finally {
    setAlterandoSenha(false);
  }
};
```

---

## 4. Atualizar config.toml

Adicionar a nova funcao:

```toml
[functions.admin-update-email]
verify_jwt = false
```

---

## Fluxo Visual

```text
┌────────────────────────────────────────────────────────────────────┐
│  TELA DE EDICAO DE USUARIO                                         │
│  /configuracoes/usuarios/:id                                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [Coluna Principal]              [Coluna Lateral]                  │
│                                                                    │
│  ┌──────────────────────┐       ┌─────────────────────────────┐   │
│  │ Informacoes Basicas  │       │ Status                      │   │
│  ├──────────────────────┤       │ [ ] Usuario ativo           │   │
│  │ Nome: [editavel]     │       └─────────────────────────────┘   │
│  │ CPF: [editavel]      │                                         │
│  │ Email: [BLOQUEADO]   │       ┌─────────────────────────────┐   │
│  │   "Email nao pode    │       │ Seguranca                   │   │
│  │    ser alterado      │       │ (Apenas Diretor/Admin)      │   │
│  │    neste campo"      │       ├─────────────────────────────┤   │
│  │ Telefone: [editavel] │       │ Novo email: [_________]     │   │
│  └──────────────────────┘       │ [Alterar Email]             │   │
│                                 │                             │   │
│  ┌──────────────────────┐       │ ─────────────────────────── │   │
│  │ Perfis de Acesso     │       │                             │   │
│  │ ...                  │       │ Nova senha: [_________]     │   │
│  └──────────────────────┘       │ [Redefinir Senha]           │   │
│                                 │                             │   │
│                                 │ "As alteracoes sao          │   │
│                                 │  aplicadas imediatamente"   │   │
│                                 └─────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Permissoes de Acesso

| Perfil | Ver Card Seguranca | Alterar Email | Alterar Senha |
|--------|-------------------|---------------|---------------|
| Diretor | Sim | Sim | Sim |
| Admin Master | Sim | Sim | Sim |
| Desenvolvedor | Nao | Nao | Nao |
| Demais perfis | Nao | Nao | Nao |

---

## Seguranca

1. **Validacao de permissoes**: Verificada no backend (edge function)
2. **Validacao de email**: Regex no backend + verificacao de duplicidade
3. **Log de auditoria**: Registrado em `auth_logs` com dados da alteracao
4. **Atualizacao sincronizada**: Email atualizado tanto em `auth.users` quanto em `profiles`

---

## Resumo das Alteracoes

| Item | Estado Atual | Estado Final |
|------|--------------|--------------|
| Campo Email (formulario) | Bloqueado sempre | Permanece bloqueado (alteracao via Card Seguranca) |
| Mensagem Email | "Email nao pode ser alterado" | "Use o painel de Seguranca para alterar" |
| Card Seguranca | Nao existe | Novo card para Diretor/Admin Master |
| Edge Function `admin-update-email` | Nao existe | Nova funcao para alterar email |
| Edge Function `admin-reset-password` | So aceita Diretor | Aceita Diretor e Admin Master |
