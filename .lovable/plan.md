

# Plano: Rebranding da Pagina Usuarios e Acessos

## Problema Atual

A pagina tem 5 abas que se sobrepoe e confundem:

```text
Atual:
┌─────────────────────────────────────────────────────┐
│ Usuarios │ Vendedores │ Perfis │ Logs │ Visibilidade│
└─────────────────────────────────────────────────────┘

- "Vendedores" = subconjunto filtrado de "Usuarios" (redundante)
- "Perfis de Acesso" = cards de roles + tabela para atribuir perfis
  (duplica o que ja se faz ao editar um usuario)
- "Visibilidade" = config avancada de modulos por perfil
- "Logs" = auditoria (contexto diferente de gestao de usuarios)
```

## Proposta: 3 Abas Claras

```text
Nova estrutura:
┌───────────────────────────────────────┐
│  Usuarios  │  Permissoes  │  Auditoria │
└───────────────────────────────────────┘
```

### Aba 1 — Usuarios (unificada)

Absorve "Usuarios" + "Vendedores" numa unica lista. Mudancas:

- Adicionar filtro rapido por **area** (Comercial, Operacional, Administrativo) — derivado do campo `area` de `app_roles_config`
- Quando filtrado por area "Comercial", exibe automaticamente as colunas de vendedor (Leads, Conversao) que hoje so aparecem na aba Vendedores
- Remove a aba "Vendedores" separada
- Manter filtros existentes: tipo, perfil, status, busca

### Aba 2 — Permissoes (consolida Perfis + Visibilidade)

Junta "Perfis de Acesso" e "Visibilidade" numa unica aba com duas secoes:

1. **Perfis do Sistema** — os cards de roles com contagem (visual existente)
2. **Visibilidade de Modulos** — a matriz de visibilidade por perfil (componente `PerfisVisibilidade` existente)

Remove a atribuicao de perfis por usuario desta aba (isso ja e feito no formulario do usuario ao clicar "Editar").

### Aba 3 — Auditoria

Renomeia "Logs de Atividade" para "Auditoria". Conteudo identico.

## Mudancas Tecnicas

| O que muda | Detalhe |
|---|---|
| Tabs de 5 para 3 | `usuarios`, `permissoes`, `auditoria` |
| Tab Usuarios | Adicionar filtro por area + colunas condicionais de vendas |
| Tab Permissoes | Renderizar cards de perfis + `PerfisVisibilidade` na mesma aba |
| Tab Vendedores | Removida |
| Tab Visibilidade | Removida (movida para Permissoes) |
| Stats cards | Remover card "Vendedores" separado, manter Total/Ativos/Inativos |
| State vars | Remover states de vendedores (`searchVendedor`, `filterTipoVendedor`) |
| Hook `useVendedores` | Continua importado para dados de leads/conversao nas colunas condicionais |

## Arquivo afetado

`src/pages/configuracoes/UsuariosAcessos.tsx` — unico arquivo, refatoracao interna.

