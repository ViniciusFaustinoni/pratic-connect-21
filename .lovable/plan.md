

# Expansao do Dashboard Juridico — KPIs, Prazos, Audiencias, Graficos e Advogados

## Resumo

Expandir o dashboard existente em `/juridico` adicionando 3 novos cards KPI, redesenhando a secao de prazos proximos como cards horizontais com badges de urgencia por cor, melhorando a secao de audiencias, adicionando grafico "Processos por Origem" e uma tabela "Resumo por Advogado". Nada do que ja existe sera removido.

## Nenhuma Migracao Necessaria

Todos os dados ja existem nas tabelas `processos_prazos`, `processos_audiencias`, `advogados`, `processos` e `consultas_juridicas`. Nao e necessario criar tabelas nem colunas.

## Arquivos a Modificar

### 1. `src/pages/juridico/JuridicoDashboard.tsx`

Este e o unico arquivo que precisa ser modificado. As mudancas sao:

**Novas queries (adicionar apos as queries existentes):**

- **Prazos vencendo 7 dias (todos os tipos):** Query em `processos_prazos` com status `pendente` e `data_fim` nos proximos 7 dias. Conta total para o KPI.

- **Audiencias esta semana:** Query em `processos_audiencias` com status `agendada` e `data_hora` entre hoje e hoje+7 dias. Conta total e verifica se alguma e hoje.

- **Carga por advogado:** Query em `processos` com status `ativo`, agrupando por `advogado_id` com join em `advogados` para pegar o nome. Retorna o advogado com mais processos e a contagem.

- **Proximos 10 prazos:** Query em `processos_prazos` com status `pendente`, join com `processos` (numero) e `profiles` (responsavel nome), ordenado por `data_fim` asc, limit 10. Inclui prazos futuros e vencidos.

- **Proximas 5 audiencias expandida:** Mesma query que ja existe mas incluindo `local`, `link_videoconferencia` e join com `advogados` para nome do advogado.

- **Processos por origem:** Query em `consultas_juridicas` e `processos` para classificar a origem: sindicancia (tem sinistro_id e veio de sindicancia), encaminhamento do analista (tem sinistro_id sem sindicancia), criado manualmente (sem sinistro_id).

- **Resumo por advogado:** Query em `advogados` ativos com subqueries: count processos ativos, count pareceres emitidos no mes (consultas_juridicas respondidas no mes onde respondido_por = advogado user_id ou advogado_id), count prazos pendentes, proxima audiencia.

**Novos 3 KPI cards (adicionar apos os 5 existentes da secao "Casos de Eventos", como segunda linha):**

1. **"Prazos Vencendo (7d)"** — borda vermelha se > 0, senao verde. Icone Clock. Mostra contagem. Subtitulo com "X vencidos | Y hoje".

2. **"Audiencias esta Semana"** — borda azul. Icone Calendar. Mostra contagem. Se alguma e hoje, subtitulo "X hoje!" em destaque.

3. **"Carga por Advogado"** — borda indigo. Icone Users. Mostra "Dr. Nome — N processos". Subtitulo com media de processos por advogado.

**Secao "Proximos Prazos" (substituir a tabela de prazos existente por cards horizontais):**

Manter o Card container mas mudar o conteudo de tabela para uma lista horizontal de cards compactos com scroll:

```text
<div className="flex gap-3 overflow-x-auto pb-2">
  {proximos10Prazos.map(prazo => (
    <Link to={`/juridico/processos/${prazo.processo_id}`}>
      <div className="min-w-[220px] rounded-lg border p-3 space-y-2 hover:bg-muted/50">
        <p className="text-sm font-medium line-clamp-1">{prazo.descricao}</p>
        <p className="text-xs text-muted-foreground">{prazo.processo?.numero}</p>
        <p className="text-xs text-muted-foreground">{prazo.responsavel?.nome || 'Sem responsavel'}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs">{formatDate(prazo.data_fim)}</span>
          <Badge com cor baseada em dias restantes />
        </div>
      </div>
    </Link>
  ))}
</div>
```

Logica de badge de urgencia por cor:
- Verde (`bg-green-100 text-green-800`): mais de 15 dias
- Amarelo (`bg-yellow-100 text-yellow-800`): 7 a 15 dias
- Laranja (`bg-orange-100 text-orange-800`): 3 a 7 dias
- Vermelho (`bg-red-100 text-red-800`): menos de 3 dias
- Preto com fundo vermelho (`bg-red-700 text-white`): ja venceu

Link "Ver todos os prazos" no final, levando para `/juridico/prazos`.

**Secao "Proximas Audiencias" (melhorar o card existente na sidebar):**

Expandir cada card de audiencia para incluir:
- Data e hora com destaque se for HOJE (borda dourada ou fundo amarelo claro)
- Tipo da audiencia (badge)
- Numero do processo (link)
- Local ou "Virtual" se tem link_videoconferencia
- Nome do advogado
- Link "Ver todas as audiencias" no rodape, levando para `/juridico/audiencias`

**Novo grafico "Processos por Origem" (adicionar na secao de graficos de processos):**

Grafico de barras horizontal com 3 barras:
- "Sindicancia" — processos/consultas onde sinistro_id nao e null e o sinistro tem resultado_sindicancia
- "Encaminhamento" — processos/consultas onde sinistro_id nao e null sem sindicancia
- "Manual" — processos/consultas onde sinistro_id e null

Posicionar na grid de graficos existente, mudando de `md:grid-cols-2` para `md:grid-cols-3` na area de graficos de processos, ou adicionando como terceiro card abaixo.

**Nova secao "Resumo por Advogado" (parte inferior, antes do modal):**

Tabela compacta dentro de um Card com:
- Colunas: Nome, OAB, Processos Ativos, Pareceres (mes), Prazos Pendentes, Proxima Audiencia
- Cada linha clicavel (link para `/juridico/advogados` ou futuro perfil)
- Se nao existirem advogados cadastrados, texto "Nenhum advogado cadastrado"

Posicionar apos a secao de grid principal (prazos + andamentos + sidebar), antes do `NovaConsultaModal`.

## Detalhes Tecnicos

- A query de "Carga por Advogado" agrupa processos ativos por `advogado_id`, faz join com `advogados` para nome, e ordena por count desc limit 1
- A query de "Resumo por Advogado" busca todos os advogados ativos e para cada um faz subqueries de contagem. Para evitar N+1, buscar processos ativos agrupados por advogado_id em uma unica query, e prazos pendentes em outra, depois combinar no frontend
- A classificacao de origem (sindicancia vs encaminhamento vs manual) e feita no frontend apos buscar os dados, verificando `sinistro_id` e campos de sindicancia
- Todas as novas queries usam `useQuery` com queryKeys distintas para cache independente
- O layout continua desktop-first, usando `grid` e `flex` com breakpoints `md:` e `lg:`
- Nenhuma dependencia nova necessaria — usa recharts, date-fns e componentes UI ja instalados

## Ordem de Implementacao

1. Adicionar as novas queries de dados (prazos 7d, audiencias semana, carga advogado, proximos 10 prazos, origem, resumo advogados)
2. Adicionar os 3 novos KPI cards apos os 5 existentes
3. Redesenhar a secao de prazos proximos para cards horizontais com badges coloridas
4. Melhorar a secao de audiencias com mais detalhes e destaque para hoje
5. Adicionar grafico "Processos por Origem"
6. Adicionar tabela "Resumo por Advogado"
