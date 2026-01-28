
# Plano: Adicionar Vistoriador Base na Tela de Novo Usuário

## Diagnóstico

A opção "Vistoriador Base" não aparece na tela `/configuracoes/usuarios/novo` porque o arquivo `src/pages/configuracoes/UsuarioForm.tsx` usa uma **lista fixa de perfis** (`perfisDisponiveis`) que não foi atualizada para incluir o novo perfil.

### Localização do Problema

**Arquivo:** `src/pages/configuracoes/UsuarioForm.tsx`  
**Linhas:** 17-29

```typescript
const perfisDisponiveis = [
  { value: 'diretor', label: 'Diretor', desc: 'Acesso total ao sistema' },
  { value: 'gerente_comercial', label: 'Gerente Comercial', desc: 'Vendas, relatórios e equipe' },
  // ... outros perfis
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', desc: 'App instalador' },
  // ❌ FALTANDO: vistoriador_base
  { value: 'analista_marketing', label: 'Analista de Marketing', desc: 'Campanhas e leads' },
  { value: 'analista_juridico', label: 'Analista Jurídico', desc: 'Processos e contratos' },
];
```

## Solução

Adicionar o perfil `vistoriador_base` à lista `perfisDisponiveis` em `UsuarioForm.tsx`, posicionando-o logo após `instalador_vistoriador` para manter uma ordem lógica.

### Alteração Necessária

**Arquivo:** `src/pages/configuracoes/UsuarioForm.tsx`

Adicionar uma nova entrada à lista:

```typescript
const perfisDisponiveis = [
  { value: 'diretor', label: 'Diretor', desc: 'Acesso total ao sistema' },
  { value: 'gerente_comercial', label: 'Gerente Comercial', desc: 'Vendas, relatórios e equipe' },
  { value: 'supervisor_vendas', label: 'Supervisor de Vendas', desc: 'Vendas da equipe' },
  { value: 'vendedor_clt', label: 'Vendedor CLT', desc: 'Vendas próprias' },
  { value: 'vendedor_externo', label: 'Vendedor Externo', desc: 'Vendas próprias' },
  { value: 'analista_cadastro', label: 'Analista de Cadastro', desc: 'Documentos e associados' },
  { value: 'coordenador_monitoramento', label: 'Coord. Monitoramento', desc: 'Instalações e rotas' },
  { value: 'analista_plataforma', label: 'Analista de Plataforma', desc: 'Rastreadores' },
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', desc: 'App instalador' },
  { value: 'vistoriador_base', label: 'Vistoriador Base', desc: 'Vistorias na base' },  // ← NOVO
  { value: 'analista_marketing', label: 'Analista de Marketing', desc: 'Campanhas e leads' },
  { value: 'analista_juridico', label: 'Analista Jurídico', desc: 'Processos e contratos' },
];
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 11 perfis listados | 12 perfis listados |
| Vistoriador Base não aparece | Vistoriador Base visível após Instalador/Vistoriador |

---

## Seção Técnica

### Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/pages/configuracoes/UsuarioForm.tsx` | 27 | Inserir novo objeto do perfil vistoriador_base |

### Código Completo da Alteração

```typescript
// Linha 26 atual:
{ value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', desc: 'App instalador' },

// Adicionar após (nova linha 27):
{ value: 'vistoriador_base', label: 'Vistoriador Base', desc: 'Vistorias na base' },

// Continua com linha 28 atual:
{ value: 'analista_marketing', label: 'Analista de Marketing', desc: 'Campanhas e leads' },
```
