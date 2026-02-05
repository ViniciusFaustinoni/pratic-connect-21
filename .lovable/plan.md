
## Remover Botão "Ver Agenda" do Card do Vistoriador

### Diagnóstico

Na página "Equipe" (`src/pages/monitoramento/Equipe.tsx`), cada card do vistoriador/instalador possui dois botões de ação:
1. "Ver Agenda" (linhas 508-511) - a ser removido
2. "Relatório" (linhas 512-515) - a manter

```text
┌────────────────────────────────────────────────────────────┐
│ Card do Vistoriador                                        │
├────────────────────────────────────────────────────────────┤
│ ...                                                        │
│ Última atividade: Há 5 minutos                             │
│                                                            │
│ ┌─────────────────┐        ┌──────────────┐               │
│ │ 📅 Ver Agenda   │        │ 📊 Relatório │               │
│ └─────────────────┘        └──────────────┘               │
│         ↓ (REMOVER)         ↓ (MANTER)                     │
└────────────────────────────────────────────────────────────┘
```

### Solução Proposta

Remover apenas o botão "Ver Agenda" (linhas 508-511) e manter apenas o botão "Relatório", que ocupará toda a largura disponível da seção de ações.

**Modificação:**
- Arquivo: `src/pages/monitoramento/Equipe.tsx`
- Linhas a remover: 508-511 (botão "Ver Agenda")
- O botão "Relatório" permanecerá, podendo expandir para preencher o espaço

**Antes:**
```
[📅 Ver Agenda]  [📊 Relatório]
```

**Depois:**
```
[📊 Relatório]
```

Ou, opcionalmente, remover a classe `flex-1` do botão "Relatório" se preferir que ele tenha tamanho natural.

### Detalhes Técnicos

| Aspecto | Detalhe |
|---------|---------|
| Arquivo | `src/pages/monitoramento/Equipe.tsx` |
| Linhas para remover | 508-511 (bloco inteiro do botão) |
| Impacto | Apenas remoção de UI, sem alterações em lógica |
| Fallback | Nenhum necessário |
