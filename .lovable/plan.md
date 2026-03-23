

# Plano: Historico de Jornadas no Perfil do Vistoriador

## Resumo

Adicionar aba "Historico" na tela InstaladorPerfil.tsx com lista dos ultimos 30 turnos, accordion para detalhes, e card de resumo mensal no topo. Sem nova rota.

---

## PARTE 1 — Reestruturar InstaladorPerfil com Tabs

Transformar o conteudo atual em sistema de 2 abas usando `Tabs` do shadcn:

- Card de avatar/nome permanece fixo acima das abas
- **Aba "Meu Perfil"**: contem tudo que existe hoje (Minha Jornada, menu, botao sair, versao)
- **Aba "Historico"**: novo componente `HistoricoJornadas`

---

## PARTE 2 — Componente `HistoricoJornadas`

**Novo arquivo**: `src/components/vistoriador/HistoricoJornadas.tsx`

### Resumo do mes (card no topo)
Calculado dos dados ja carregados (turnos do mes corrente):
- Dias trabalhados, total horas, saldo acumulado do mes, total servicos concluidos

### Lista de turnos (ultimos 30 dias)
Query `turnos_profissionais` com `profissional_id`, `status = 'encerrado'`, ultimos 30 dias, order desc, limit 30.

Para servicos concluidos por dia: query separada em `servicos` agrupando por data (ou buscar todos do periodo e agrupar client-side).

Cada card compacto:
- Data formatada ("Segunda, 20 jan"), badge de status, horas trabalhadas, servicos, saldo (condicional)

Status:
- "Concluido": `minutos_trabalhados >= (jornada_duracao_turno * 60 - 10)`
- "Incompleto": menos horas que esperado
- "Improdutivo": 0 servicos concluidos

### Accordion expand
Ao tocar, expandir inline com `Accordion` do shadcn:
- `inicio_turno` / `fim_turno` formatados
- `minutos_almoco` utilizado
- Recusas do dia (query `registros_recusa_tarefa`)
- `minutos_extras` / `minutos_faltantes`

### Paginacao
Botao "Carregar mais" incrementando offset em 30.

### Configs lidas
- `jornada_exibir_saldo_vistoriador` e `jornada_duracao_turno_horas` da query de configs ja existente

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/instalador/InstaladorPerfil.tsx` | Reestruturar com Tabs, mover conteudo para aba "Meu Perfil" |
| `src/components/vistoriador/HistoricoJornadas.tsx` | **Novo** — lista de turnos + resumo mensal |

