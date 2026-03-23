

# Plano: Reorganizar Formulário — Tipo de Usuário como Primeiro Campo

## Problema

1. O campo "Tipo de usuário" fica DEPOIS das informações básicas — deveria vir primeiro para triar o tipo de cadastro
2. Não existe a opção "Agência" no tipo de usuário — só Funcionário, Associado, Prestador
3. Os campos CNPJ/Razão Social só aparecem se o perfil "agencia" estiver selecionado nos checkboxes (que ficam mais abaixo), criando dependência circular

## Solução

### 1. Adicionar "Agência" como tipo de usuário

No select de tipo (linha 608-613), adicionar:
```
<SelectItem value="agencia">Agência</SelectItem>
```

### 2. Mover "Tipo de Usuário" para ANTES do card de Informações Básicas

Extrair o campo "Tipo de usuário" para um card próprio no topo do formulário, antes de qualquer outro campo. Assim o tipo triará o que aparece abaixo.

### 3. Lógica condicional baseada no tipo (não no perfil)

Trocar a condição `formData.perfis.includes('agencia')` por `formData.tipo === 'agencia'`:
- **tipo = agencia**: mostrar CNPJ, Razão Social, Nome Fantasia (esconder CPF)
- **tipo ≠ agencia**: mostrar CPF (esconder campos empresariais)

Quando `tipo === 'agencia'`, auto-selecionar o perfil `agencia` nos checkboxes.

### 4. Ajustar saveUser

Na lógica de save, trocar `isAgencia` de `formData.perfis.includes('agencia')` para `formData.tipo === 'agencia'`.

## Arquivo afetado

`src/pages/configuracoes/UsuarioForm.tsx` — único arquivo.

