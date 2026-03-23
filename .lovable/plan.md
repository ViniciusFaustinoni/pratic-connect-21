

# Plano: Nova aba "Viagens" em Instalacoes e Vistorias

## Resumo

Criar componente `ViagensTab.tsx` e adiciona-lo como quarta aba na pagina VistoriasInstalacoesMon.tsx.

---

## Alteracoes

### 1. Novo arquivo: `src/pages/monitoramento/ViagensTab.tsx`

Componente autonomo que renderiza:

**Cards de resumo** (condicionais a `viagem_valor_diaria > 0`):
- Viagens ativas: query em `instalacoes` com `tipo_deslocamento = 'viagem'` e status em aberto (`agendada`, `em_rota`, `em_andamento`, `reagendada`)
- Tecnicos em viagem hoje: count distinct de `instalador_id` em instalacoes viagem agendadas para hoje
- Diarias no mes: sum de `bonus_viagem` em `turnos_profissionais` no mes atual

**Filtros**:
- Status: Select com opcoes "Todas", "Em aberto", "Concluidas"
- Tecnico: Select populado via query em `profiles` (instaladores)
- Periodo: DatePickerWithRange com mes atual como padrao

**Tabela**:
- Query `instalacoes` filtrada por `tipo_deslocamento = 'viagem'`, ordenada por `data_agendada` desc
- Colunas: Associado/municipio, Tecnico, Data agendada, Status (badge existente), SLA (SlaIndicador existente), Diaria (condicional)
- Click na linha: `navigate(/monitoramento/instalacoes/:id)`
- Estado vazio: "Nenhuma viagem no periodo selecionado."

**Config**: buscar `viagem_valor_diaria` da tabela `configuracoes` para condicionar cards e coluna de diaria.

### 2. `src/pages/monitoramento/VistoriasInstalacoesMon.tsx`

- Importar `Truck` do lucide-react
- Importar `ViagensTab` do novo arquivo
- Adicionar TabsTrigger "Viagens" com icone Truck apos "Encaixes"
- Adicionar TabsContent renderizando `<ViagensTab />`

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/ViagensTab.tsx` | **Novo** componente |
| `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` | Nova aba |

