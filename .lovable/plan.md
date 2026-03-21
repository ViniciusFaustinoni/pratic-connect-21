

# Plano: Remover botões manuais da aba Vistorias (monitoramento)

A aba "Vistorias" dentro de "Vistorias e Instalações" no Monitoramento é apenas para acompanhamento do processo automático. Os botões "Realizar Vistoria" e o dialog associado não deveriam estar lá.

## Alterações em `src/pages/monitoramento/Vistorias.tsx`

1. **Remover botão "Realizar Vistoria" do header** (linhas 73-79)
2. **Alterar texto descritivo** de "Realize e gerencie vistorias" para "Acompanhe vistorias de entrada de veículos"
3. **Remover botão do estado vazio** (linhas 126-129) e alterar texto de "Comece realizando uma nova vistoria" para "Nenhuma vistoria registrada no momento"
4. **Remover estado `dialogOpen`** e o componente `RealizarVistoriaDialog` (já que não será mais usado)
5. **Remover imports** não utilizados: `Plus`, `RealizarVistoriaDialog`

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/Vistorias.tsx` | Remover botões manuais, dialog e ajustar textos |

