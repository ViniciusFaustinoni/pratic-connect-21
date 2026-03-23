

# Plano: Sidebar + Correcao Status Softruck

## PARTE 1 — Sidebar

Auditoria confirma que **todos os itens ja existem** no sidebar:
- Monitoramento: "Prestadores Parceiros" (L232), "Encaixes" (L233) ✅
- RH: "Treinamentos" (L368), "Recrutamento" (L369) ✅
- Diretoria: "Gestao de Rotas" foi consolidado como aba dentro de "Vistorias e Instalacoes" (prompt anterior aprovado)

**Nenhuma alteracao necessaria na sidebar.**

---

## PARTE 2 — Correcao Status Softruck

### Problema

Softruck exige `configurado && testado` para mostrar "Conectado" (linha 203 de Integracoes.tsx). Se nenhum health check foi executado, `testado` e `false` e o status fica "Pendente".

### Correcao

Alterar para `ativo: s.configurado` em dois arquivos:

**Arquivo 1**: `src/pages/configuracoes/Integracoes.tsx` (linha 203)
- De: `ativo: s.configurado && s.testado`
- Para: `ativo: s.configurado`

**Arquivo 2**: `src/components/integracoes/ServicosTab.tsx` (linha 315)
- De: `ativo: integracoes.softruck.configurado && integracoes.softruck.testado`
- Para: `ativo: integracoes.softruck.configurado`

Aplicar a mesma correcao para `rede_veiculos` por consistencia (linhas 212 e 323 respectivamente).

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/configuracoes/Integracoes.tsx` | Softruck e Rede Veiculos: remover `&& testado` |
| `src/components/integracoes/ServicosTab.tsx` | Mesma correcao |

