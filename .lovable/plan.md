

# Adicionar Regulador e Analista de Eventos aos Perfis de Acesso

## Problema

Os tipos `regulador` e `analista_eventos` ja existem no sistema (enum `PerfilAcesso`, labels, cores, guards, layouts e paineis). Porem, ao criar ou editar um usuario, esses dois perfis **nao aparecem como opcao selecionavel** nas telas de formulario.

Tres listas estaticas de perfis precisam ser atualizadas:

## Correcoes

### 1. Formulario de criacao/edicao de usuario

**Arquivo:** `src/pages/configuracoes/UsuarioForm.tsx` (linha 19-32)

Adicionar ao array `perfisDisponiveis`:

```text
{ value: 'regulador', label: 'Regulador', desc: 'Vistorias e oficina' },
{ value: 'analista_eventos', label: 'Analista de Eventos', desc: 'Analise de sinistros' },
```

### 2. Modal "Gerenciar Perfis" (edicao rapida de roles)

**Arquivo:** `src/components/usuarios/GerenciarPerfisModal.tsx` (linha 40-53)

Adicionar ao array `PERFIS_FUNCIONARIO`:

```text
'regulador',
'analista_eventos',
```

### 3. Modal "Novo Funcionario"

**Arquivo:** `src/components/usuarios/NovoFuncionarioModal.tsx` (linha 36-49)

Adicionar ao array `PERFIS_FUNCIONARIO`:

```text
'regulador',
'analista_eventos',
```

## Resultado

Apos as correcoes, ao criar ou editar um usuario, os cards "Regulador" e "Analista de Eventos" aparecerao na grade de perfis de acesso (como na imagem de referencia). Ao selecionar um desses perfis, o usuario tera acesso ao respectivo painel (`/regulador` ou `/analista-eventos`), que ja estao implementados com seus guards e layouts.

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/pages/configuracoes/UsuarioForm.tsx` -- adicionar 2 perfis ao array perfisDisponiveis |
| Modificar | `src/components/usuarios/GerenciarPerfisModal.tsx` -- adicionar 2 perfis ao array PERFIS_FUNCIONARIO |
| Modificar | `src/components/usuarios/NovoFuncionarioModal.tsx` -- adicionar 2 perfis ao array PERFIS_FUNCIONARIO |

