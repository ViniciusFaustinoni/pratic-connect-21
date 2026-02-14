

# Relatorios Completos -- Oficinas, Prestadores e Auto Centers

## Objetivo

Reescrever a pagina `/oficinas/relatorios` para se tornar um painel de relatorios abrangente, cobrindo os tres tipos de fornecedores e cruzando dados com marcas, veiculos e tipos de servico.

## Estrutura da Pagina

A pagina tera abas (Tabs) para organizar os relatorios:

### Aba 1: Visao Geral (Resumo)

Cards de resumo no topo:
- Total de veiculos em reparo (OS ativas)
- Total de cotacoes de pecas em andamento
- Total de chamados de assistencia abertos
- Valor total de orcamentos (OS ativas)

Grafico de barras: distribuicao de OS por marca do veiculo (join `ordens_servico` -> `veiculos.marca`)

### Aba 2: Oficinas (Servicos)

Dados ja existentes (manter), mais:
- Coluna "Marcas Atendidas" na tabela
- Coluna "Especialidades" na tabela
- Coluna "Valor Total Orcamentos" (soma de `valor_orcamento` das OS ativas)
- Coluna "OS Finalizadas" (contagem de OS concluidas)
- Grafico: OS por marca do veiculo por oficina (top 10)
- Tabela: ranking de oficinas por volume e tempo medio

Fonte: `ordens_servico` com join em `oficinas` e `veiculos`

### Aba 3: Auto Centers (Pecas)

- Total de cotacoes enviadas por auto center
- Total de cotacoes aprovadas vs pendentes vs recusadas
- Valor total das cotacoes aprovadas
- Marcas atendidas por auto center
- Grafico: cotacoes por marca do veiculo (join `evento_cotacoes_pecas` -> `sinistros` -> `veiculos`)
- Tabela detalhada com colunas: Nome, Cotacoes Enviadas, Aprovadas, Valor Total, Marcas

Fonte: `evento_cotacoes_pecas` com join em `auto_centers`, `sinistros` e `veiculos`

### Aba 4: Prestadores (Assistencias)

- Total de chamados de assistencia atendidos por prestador
- Tipo de servico mais frequente (campo `tipo_servico` de `chamados_assistencia`)
- Tempo medio de conclusao (diferenca entre `data_abertura` e `data_conclusao`)
- Grafico: chamados por tipo de servico
- Tabela: Nome do prestador, Chamados Atendidos, Tipo Servico Principal, Tempo Medio

Fonte: `chamados_assistencia` com join em `prestadores_evento` e `veiculos`

## Alteracoes Tecnicas

### Arquivo: `src/pages/oficinas/OficinasRelatorios.tsx`

Reescrever completamente para incluir:

1. **Componente principal** com `Tabs` (Radix UI, ja disponivel) para as 4 abas
2. **Hook `useRelatorioGeral`**: queries para cards de resumo
3. **Hook `useRelatorioOficinas`**: query atual expandida com join em `veiculos` para trazer marca
4. **Hook `useRelatorioAutoCenters`**: query em `evento_cotacoes_pecas` com joins
5. **Hook `useRelatorioPrestadores`**: query em `chamados_assistencia` com joins

Cada aba sera um componente interno para manter o arquivo organizado, mas tudo no mesmo arquivo para simplicidade.

### Queries principais

**Oficinas (expandida)**:
```
ordens_servico -> select oficina_id, status, valor_orcamento, tempo_total_dias, 
  oficina:oficinas(nome_fantasia, razao_social, especialidades, marcas_atendidas),
  veiculo:veiculos(marca, modelo)
```

**Auto Centers**:
```
evento_cotacoes_pecas -> select auto_center_id, status, valor_total, aprovada,
  auto_center:auto_centers(nome, especialidades, marcas_atendidas),
  sinistro:sinistros!sinistro_id(veiculo:veiculos(marca, modelo))
```

**Prestadores**:
```
chamados_assistencia -> select prestador_id, tipo_servico, status, data_abertura, data_conclusao,
  prestador:prestadores_evento(razao_social, nome_fantasia, especialidades),
  veiculo:veiculos(marca, modelo)
```

### Graficos

Usar `recharts` (ja instalado) para:
- Grafico de barras empilhadas: OS por marca
- Grafico de barras: cotacoes por auto center
- Grafico de pizza: chamados por tipo de servico

### Layout Visual

```text
+--------------------------------------------------+
|  Relatorios de Fornecedores                       |
|  [Visao Geral] [Oficinas] [Auto Centers] [Prest.] |
+--------------------------------------------------+
| Cards de resumo (4 cards)                         |
+--------------------------------------------------+
| Grafico principal da aba selecionada              |
+--------------------------------------------------+
| Tabela detalhada da aba selecionada               |
+--------------------------------------------------+
```

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Reescrever | `src/pages/oficinas/OficinasRelatorios.tsx` |

Nenhum outro arquivo precisa ser alterado -- a rota e o menu lateral ja existem.

