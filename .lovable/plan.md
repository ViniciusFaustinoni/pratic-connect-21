

## Plano: Ícone Pulsante da Base Pratic no Mapa de Atribuições

### Objetivo
Exibir um ícone pulsante na posição de cada Base da Pratic no mapa de atribuições, mostrando a quantidade de vistorias base pendentes. Ao clicar, abre o modal de atribuição (`CalendarioDiaModal`) filtrado na aba "Base".

### Mudanças

#### 1. `src/components/mapa/MapaVistoriasContent.tsx`

- Importar `useBasesPratic` e `CalendarioDiaModal`
- Adicionar query para contar agendamentos base pendentes do dia (status NOT IN concluida/cancelado) agrupados por base (usando coordenadas da oficina ou um campo de referência)
- Criar um ícone DivIcon customizado com animação pulse CSS, formato circular com cor destacada (ex: roxo/azul) e badge com contagem
- Para cada base Pratic com coordenadas, renderizar um `Marker` no mapa com:
  - Ícone pulsante mostrando quantidade de vistorias base não concluídas do dia
  - Tooltip com nome da base
  - `onClick`: abre o `CalendarioDiaModal` na data de hoje, aba "Base"
- Adicionar estado `baseModalOpen` e `baseModalData` para controlar abertura do modal

#### 2. Query de contagem

- Buscar da tabela `agendamentos_base` onde `data_agendada = hoje` e `status NOT IN ('concluida', 'cancelado')` para obter a contagem de pendentes
- A query será feita diretamente no componente (inline useQuery) para manter simplicidade

#### 3. Ícone visual

- Círculo com borda pulsante (CSS `animate-ping` overlay)
- Ícone `Building2` centralizado
- Badge com número no canto superior direito
- Se contagem = 0, ícone sem pulse e opacidade reduzida

#### 4. `CalendarioDiaModal` — ajuste menor

- Aceitar prop opcional `abaInicial` para abrir diretamente na aba "Base" quando chamado do mapa

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/mapa/MapaVistoriasContent.tsx` | Adicionar markers das bases + modal |
| `src/components/monitoramento/CalendarioDiaModal.tsx` | Aceitar `abaInicial` prop |

