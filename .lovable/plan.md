

# Adicionar campo de senha ao formulario de cadastro de sindicante + definir senha do usuario existente

## Resultado do Teste

O fluxo de cadastro de sindicante funciona corretamente:
- Formulario preenche todos os campos (empresa, responsavel, configuracao)
- Usuario e criado via edge function `create-user`
- Empresa aparece na tabela com KPIs atualizados
- Painel lateral exibe todos os dados corretamente (razao social, CNPJ, responsavel, especialidades, regioes, valor, historico)

**Problema identificado:** O formulario NAO tem campo de senha. O usuario e criado via magic link (primeiro_acesso: true). Para que o sindicante possa logar com email/senha, e necessario adicionar o campo.

---

## 1. Adicionar campo "Senha" ao formulario de novo sindicante

**Arquivo:** `src/pages/eventos/SindicantesAdmin.tsx`

### Alteracoes no form state (linha ~63)
Adicionar `senha: ''` ao estado inicial do form.

### Alteracoes no JSX (apos o campo de Email, ~linha 511)
Adicionar campo de senha (visivel apenas na criacao, nao na edicao):

```
{!editing && (
  <div className="space-y-1.5 sm:col-span-2">
    <Label>Senha * <span className="text-xs text-muted-foreground">(minimo 6 caracteres)</span></Label>
    <Input type="password" value={form.senha} onChange={...} />
  </div>
)}
```

### Alteracoes na validacao (linha ~165)
Adicionar validacao: se nao e edicao, senha obrigatoria e minimo 6 chars.

### Alteracoes no handleSave (linha ~218)
Passar `senha: form.senha` no body do `create-user`:

```javascript
const res = await supabase.functions.invoke('create-user', {
  body: {
    nome: form.responsavel_nome,
    email: form.responsavel_email,
    senha: form.senha,  // <-- adicionar
    ...
  },
});
```

A edge function `create-user` ja suporta o campo `senha` — quando presente, cria o usuario com senha direta em vez de magic link.

---

## 2. Definir senha do sindicante existente (sindicante@teste.com)

Apos implementar a mudanca acima, usar a interface do app para redefinir a senha. Alternativa: chamar a edge function `admin-reset-password` com `userId: 'afe41f0f-f2f6-430a-9a00-8d0161eb2201'` e `novaSenha: 'sindicante@teste.com'` (a funcao exige minimo 8 chars, e 'sindicante@teste.com' tem 20 chars, entao atende).

Como nao ha interface de reset na pagina de sindicantes, farei a chamada programaticamente no browser apos o deploy.

Tambem atualizar `primeiro_acesso` para `false` no profile.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SindicantesAdmin.tsx` | Adicionar campo senha ao form state, JSX, validacao e chamada do create-user |

## Sequencia

1. Modificar `SindicantesAdmin.tsx` com campo de senha
2. Definir a senha do usuario existente via `admin-reset-password`
3. Atualizar `primeiro_acesso` para false no profile
4. Testar login com sindicante@teste.com

