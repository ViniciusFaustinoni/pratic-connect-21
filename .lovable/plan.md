

# Plano: Modal de Resumo do Dia ao Encerrar Turno

## Resumo

Exibir automaticamente um modal com o resumo do dia quando o turno encerra, mostrando horas trabalhadas, servicos concluidos/recusados, saldo do turno e saldo acumulado. O modal aparece uma unica vez por turno usando sessionStorage.

---

## PARTE 1 — Componente `ModalResumoDia`

**Novo arquivo**: `src/components/vistoriador/ModalResumoDia.tsx`

Props:
- `open: boolean`
- `onClose: () => void`
- `turno: TurnoProfissional` (dados do turno encerrado)
- `servicosConcluidos: number`
- `servicosRecusados: number`
- `exibirSaldoAcumulado: boolean`

Dialog com `onInteractOutside` e `onEscapeKeyDown` prevenidos + sem botao X:
- Titulo: "Turno encerrado ✓"
- Secao "Seu dia em numeros": horas trabalhadas (formatarMinutos), servicos concluidos, recusados (se > 0)
- Secao "Saldo do turno": `minutos_extras - minutos_faltantes` — verde/vermelho/neutro
- Secao "Saldo acumulado" (condicional): `saldo_anterior_minutos + extras - faltantes`
- Botao "Entendido" que chama `onClose`

---

## PARTE 2 — Logica no `useJornadaTrabalho.ts`

Adicionar estado e controle de exibicao:

- `mostrarResumoDia: boolean` — state interno
- `useEffect` que observa `turno?.status`: quando muda para `'encerrado'` e `turno?.id` existe:
  - Verificar `sessionStorage.getItem('resumo-turno-' + turno.id)`
  - Se nao existe: setar `mostrarResumoDia = true`
- `fecharResumoDia()`: seta `sessionStorage.setItem('resumo-turno-' + turno.id, 'true')` e `mostrarResumoDia = false`
- Expor: `mostrarResumoDia`, `fecharResumoDia`

---

## PARTE 3 — Integracao no `InstaladorHome.tsx`

- Importar `ModalResumoDia`
- Usar `mostrarResumoDia` e `fecharResumoDia` do hook (via useJornadaTrabalho — precisara chamar o hook aqui ou extrair de onde ja e usado)
- Queries condicionais (habilitadas quando `mostrarResumoDia === true`):
  - Servicos concluidos: `servicos` com `profissional_id`, `status = 'concluida'`, `data = hoje`
  - Servicos recusados: `registros_recusa_tarefa` com `profissional_id`, `created_at` de hoje
  - Config `jornada_exibir_saldo_vistoriador`
- Renderizar `<ModalResumoDia>` ao final do JSX

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/vistoriador/ModalResumoDia.tsx` | **Novo** |
| `src/hooks/useJornadaTrabalho.ts` | Estado `mostrarResumoDia` + `fecharResumoDia` + sessionStorage |
| `src/pages/instalador/InstaladorHome.tsx` | Queries condicionais + render do modal |

