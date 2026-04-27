## Diagnóstico

O sistema **parcialmente** atende ao requisito. Hoje:

| Layout | "Relatar Erro" | "Testar Correções" |
|---|---|---|
| `AppHeader` (sistema interno: diretor, admin, vendedor, financeiro, sindicante, monitoramento, RH etc.) | ✅ | ✅ |
| `AppUserDropdown` (App do Associado) | ✅ | ✅ |
| Agência (`AgenciaLayout`) | ❌ | ❌ |
| **Instalador / Vistoriador** (`InstaladorLayout`) | ❌ | ❌ |
| **Regulador** (`ReguladorLayout`) | ❌ | ❌ |
| **Analista de Eventos** (`AnalistaEventosLayout`) | ❌ | ❌ |

A RLS já permite que qualquer usuário autenticado crie um `error_report` (`reporter_id = auth.uid()`), então o backend está pronto — falta só expor a UI nesses 4 layouts.

## Plano

Adicionar o item **"Relatar Erro"** (abre `RelatarErroModal`) e o botão **"Testar Correções"** (`TestarCorrecoesButton`, com badge de pendências do próprio usuário) nos 4 layouts que ainda não os possuem.

### 1. `InstaladorLayout.tsx`
- Adicionar `TestarCorrecoesButton` no header, ao lado do avatar.
- Adicionar item **"Relatar Erro"** (ícone `Bug`) no `DropdownMenu` do usuário, antes de "Sair".
- Renderizar `<RelatarErroModal />` controlado por estado local.

### 2. `ReguladorLayout.tsx`
- Mesma adição: botão de testar no header + item "Relatar Erro" no dropdown + modal.

### 3. `AnalistaEventosLayout.tsx`
- Mesma adição.

### 4. `AgenciaLayout.tsx`
- Adicionar botão "Relatar Erro" e "Testar Correções" na barra de ações do header (ao lado dos navItems / botão Sair).

### Observações técnicas
- Reutilizar exatamente os componentes já existentes: `RelatarErroModal` e `TestarCorrecoesButton`. Nada de duplicar lógica.
- O `TestarCorrecoesButton` já filtra automaticamente por `reporter_id = auth.uid()`, então a contagem aparecerá só para os relatos do próprio usuário.
- Nenhuma mudança no banco/RLS é necessária.
- Nos layouts mobile (Instalador/Regulador/Analista), o ícone fica compacto no header e o item "Relatar Erro" entra no menu para não poluir.

### Resultado esperado
Após a implementação, **qualquer usuário autenticado** (diretor, admin, vendedor, técnico/instalador, regulador, analista de eventos, agência, associado, sindicante, financeiro etc.) terá acesso ao fluxo de relato de erros e à validação de correções pertinentes a ele.
