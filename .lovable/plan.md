
# Análise: Comportamento do Botão "Suspender Associado"

## Status Atual

O botão **"Suspender"** já funciona corretamente e realiza as seguintes ações:

| Ação | Status | Detalhe |
|------|--------|---------|
| Alterar status para "suspenso" | ✅ Funciona | Atualiza o campo `status` no banco |
| Registrar motivo do bloqueio | ✅ Funciona | Campo `motivo_bloqueio` |
| Registrar data do bloqueio | ✅ Funciona | Campo `data_bloqueio` |
| Salvar histórico | ✅ Funciona | Evento em `associados_historico` |
| Notificar Rede Veículos | ✅ Funciona | Edge Function chamada |
| Exibir badge "Suspenso" | ✅ Funciona | Badge amarelo aparece |
| Exibir botão "Reativar" | ✅ Funciona | Aparece quando suspenso |

---

## O que pode melhorar (Opcional)

Atualmente o badge "Suspenso" é exibido, mas **não há alertas visuais destacados**. Podemos adicionar:

### 1. Banner de Alerta para Associado Suspenso

Um banner no topo do card do associado quando estiver suspenso:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ ASSOCIADO SUSPENSO                                   │
│ Motivo: Suspenso pelo sistema                           │
│ Data: 03/02/2026                                        │
│ O associado não tem acesso aos benefícios da proteção.  │
└─────────────────────────────────────────────────────────┘
```

### 2. Alterar cor do card de cabeçalho

Quando suspenso, adicionar borda amarela/vermelha no card principal para destaque visual.

### 3. Dialog com campo de motivo

Atualmente o dialog de suspensão é simples. Podemos adicionar um campo de texto para o operador informar o motivo da suspensão (semelhante ao `SuspenderVeiculoDialog`).

---

## Alterações Propostas

### Arquivo: `src/pages/cadastro/AssociadoDetalhe.tsx`

1. **Adicionar banner de alerta** quando `status === 'suspenso'`
   - Exibir ícone de alerta
   - Mostrar motivo do bloqueio (`associado.motivo_bloqueio`)
   - Mostrar data do bloqueio (`associado.data_bloqueio`)

2. **Melhorar dialog de suspensão**
   - Adicionar campo de texto para motivo
   - Adicionar opções pré-definidas (Inadimplência, Solicitação, etc.)

### Código do Banner

```tsx
{/* Banner de Alerta - Associado Suspenso */}
{status === 'suspenso' && (
  <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 flex items-start gap-3">
    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
    <div>
      <h4 className="font-semibold text-yellow-800">Associado Suspenso</h4>
      <p className="text-sm text-yellow-700">
        {associado.motivo_bloqueio || 'Sem motivo informado'}
      </p>
      {associado.data_bloqueio && (
        <p className="text-xs text-yellow-600 mt-1">
          Suspenso em: {formatDate(associado.data_bloqueio)}
        </p>
      )}
    </div>
  </div>
)}
```

---

## Resumo

O sistema **já funciona como esperado**:
- O botão suspende o associado no banco
- O badge "Suspenso" aparece no lugar de "Ativo"
- O botão "Reativar" fica disponível

**Quer que eu adicione o banner de alerta visual** para deixar mais evidente quando o associado está suspenso?
