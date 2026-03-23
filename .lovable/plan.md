

# Plano: Linha "Dia de viagem" no accordion do HistoricoJornadas

## Alteracao

**Arquivo**: `src/components/vistoriador/HistoricoJornadas.tsx`

Apos o bloco de recusas (linha 247), antes do `</div>` que fecha o `space-y-2`, adicionar:

```tsx
{turno.em_viagem && (
  <div className="flex justify-between text-blue-400">
    <span>🚗 Dia de viagem</span>
    {(turno.bonus_viagem || 0) > 0 && (
      <span>R$ {Number(turno.bonus_viagem).toFixed(2).replace('.', ',')} diária</span>
    )}
  </div>
)}
```

Nenhuma outra alteracao necessaria — os campos `em_viagem` e `bonus_viagem` ja existem na tabela `turnos_profissionais` e o select ja usa `*`.

