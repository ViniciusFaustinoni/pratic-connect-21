

## Filtro de rastreadores — adicionar busca por data de instalação

### Estado atual (já implementado — não vou refazer)

A busca de texto na aba **Rastreadores** já cobre:
- IMEI, código e número de série do rastreador
- **Placa** do veículo vinculado (já implementada em `useRastreadores.ts` — busca via tabela `veiculos`)
- **Nome e CPF do associado** vinculado (já implementada via tabela `associados`)

Confirmo que esses três campos já funcionam no input "Buscar por IMEI, código, placa ou nome do associado…". Se você está vendo algum caso onde a busca por placa/associado não retorna resultado, me diz a placa/nome exato para eu investigar — pode ser uma falha pontual de dado, não de filtro.

### O que falta (vou implementar)

**Filtro por data de instalação** — hoje não existe. A data real de instalação fica em `servicos.concluida_em` (onde `tipo='instalacao'` e `rastreador_id` aponta para o rastreador). Vou adicionar um filtro de intervalo de datas que cruza com essa tabela.

### Mudanças

#### 1. UI — `RastreadorFiltersV2.tsx`
- Dentro do painel expandido "Filtros", adicionar nova seção **"Data de instalação"** com dois `DatePicker` (de / até) usando o componente `Calendar` já existente no projeto.
- Botão "Limpar período" ao lado.
- Adicionar badge resumindo o período quando filtro está ativo (ex.: "01/03/2026 → 15/04/2026").

#### 2. Tipagem — `useRastreadores.ts`
Adicionar em `RastreadorFilters`:
```
data_instalacao_inicio?: string;  // ISO date
data_instalacao_fim?: string;     // ISO date
```

#### 3. Lógica de query — `useRastreadores.ts`
Quando qualquer uma das datas estiver preenchida:
1. Consultar `servicos` filtrando `tipo='instalacao'`, `status='concluida'` (ou equivalente), e `concluida_em` dentro do período informado.
2. Coletar `rastreador_id` distintos do resultado.
3. Aplicar `query.in('id', rastreadorIdsDoPeriodo)` na consulta principal.
4. Se o set vier vazio, retornar `items: []` direto sem ir ao Supabase.

Combina com os demais filtros (status, plataforma, comunicação, search) usando `AND`.

#### 4. Indicador de filtro ativo
- Incluir o período no `activeFiltersCount` e no bloco de badges quando o painel estiver fechado, com botão `X` para limpar.

### Critérios de aceitação

1. Painel "Filtros" expandido mostra novo bloco "Data de instalação" com dois seletores de data.
2. Selecionar período retorna apenas rastreadores cuja instalação (`servicos.tipo='instalacao'`, `concluida_em` dentro do range) ocorreu naquele intervalo.
3. Combina corretamente com filtros de status, plataforma, comunicação e busca por texto.
4. Badge mostra o período ativo quando o painel está fechado e permite limpar.
5. Busca por placa, nome do associado e CPF continua funcionando como hoje.

### Fora de escopo

- Adicionar coluna `data_instalacao` direto em `rastreadores` (a fonte de verdade é o serviço concluído).
- Filtros por data de criação ou data de baixa do rastreador (posso adicionar depois se quiser).
- Exportação CSV filtrada por período.

