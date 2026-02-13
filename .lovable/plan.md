
# Registrar custo da OS ao liberar veiculo

## Problema
Quando o veiculo e liberado (handleLiberarVeiculo), o sistema atualiza status da OS e do sinistro, mas **nao registra o custo financeiro**. Isso faz com que o valor da OS nao apareca em nenhum dashboard, relatorio ou contabilidade.

## Areas impactadas identificadas

| Area | Como busca custos | Status atual |
|------|-------------------|--------------|
| **Custos de Reparos** (useCustosReparos.ts) | Itens de OS com status `concluido/pago/aprovado` | Falta `finalizado` no filtro |
| **Dashboard Diretor** (DiretoriaDashboard.tsx) | `sinistros.valor_indenizacao` com status `aprovado/indenizado` | Falta `encerrado` e valor nao e atualizado |
| **Indicadores Atuariais** (IndicadoresAtuariais.tsx) | `sinistros.valor_indenizacao` com status `aprovado/indenizado/pago` | Falta `encerrado` |
| **Rateio Sinistros** (RateioSinistros.tsx) | `sinistros.valor_indenizacao` com status `aprovado/pago` | Falta `encerrado` |
| **Produto Detalhe** (ProdutoDetalhe.tsx) | `sinistros.valor_indenizacao` com status `aprovado/indenizado` | Falta `encerrado` |
| **Contabilidade** (lancamentos_contabeis) | Lancamento automatico via `criarLancamentoAutomatico` | Nenhum lancamento e criado |
| **Relatorios Gerenciais** (RelatoriosGerenciais.tsx) | Busca itens de OS com status filtrado | Falta `finalizado` |

## Solucao em 2 partes

### Parte 1: Registrar custos ao liberar veiculo

**Arquivo: `src/components/oficinas/OSConclusaoModal.tsx`**

No `handleLiberarVeiculo`, apos finalizar OS e encerrar sinistro, adicionar:

1. **Atualizar `sinistros.valor_indenizacao`** com o valor do orcamento da OS (`os.valor_orcamento`), para que dashboards e rateio capturem o custo
2. **Criar lancamento contabil automatico** usando `criarLancamentoAutomatico` do hook `useLancamentosContabeis`:
   - Debito: conta `REPAROS_OFICINAS` (5.1.01.002)
   - Credito: conta `BANCO_CONTA_MOVIMENTO` (1.1.01.002)
   - Valor: `os.valor_orcamento`
   - Origem: `ordem_servico`
   - Historico: `Reparo sinistro - OS {numero} - Oficina {nome}`

Imports adicionais: `useLancamentosContabeis` e `CONTAS_PADRAO` de `contabilidade-config`

### Parte 2: Incluir status `finalizado` e `encerrado` nos filtros de consulta

**Arquivo: `src/hooks/useCustosReparos.ts`** (linha 77)
- Adicionar `'finalizado'` ao array de status: `['concluido', 'pago', 'aprovado', 'finalizado']`

**Arquivo: `src/pages/diretoria/DiretoriaDashboard.tsx`** (linha 110)
- Adicionar `'encerrado'` ao filtro: `.in('status', ['aprovado', 'indenizado', 'encerrado'])`

**Arquivo: `src/pages/diretoria/IndicadoresAtuariais.tsx`** (linha 94)
- Adicionar `'encerrado'`: `.in('status', ['aprovado', 'indenizado', 'pago', 'encerrado'])`

**Arquivo: `src/hooks/useDiretoria.ts`** (linhas 23 e 91)
- Adicionar `'encerrado'` nos dois filtros de sinistros: `.in('status', ['aprovado', 'pago', 'encerrado'])`

**Arquivo: `src/pages/diretoria/RateioSinistros.tsx`**
- Verificar filtro de sinistros e adicionar `'encerrado'` se necessario

## Resumo de arquivos alterados

1. `src/components/oficinas/OSConclusaoModal.tsx` - registrar custo + lancamento contabil
2. `src/hooks/useCustosReparos.ts` - adicionar `finalizado` ao filtro
3. `src/pages/diretoria/DiretoriaDashboard.tsx` - adicionar `encerrado` ao filtro
4. `src/pages/diretoria/IndicadoresAtuariais.tsx` - adicionar `encerrado` ao filtro
5. `src/hooks/useDiretoria.ts` - adicionar `encerrado` aos filtros
6. `src/pages/diretoria/RateioSinistros.tsx` - adicionar `encerrado` ao filtro (se aplicavel)

## Fluxo resultante

```text
Liberar Veiculo (click)
  |
  +-> OS status = finalizado
  +-> Sinistro status = encerrado
  +-> Sinistro valor_indenizacao = OS valor_orcamento
  +-> Lancamento contabil criado (D: Reparos Oficinas / C: Banco)
  +-> Invalidar queries (dashboards se atualizam)
  +-> Toast de sucesso + fechar modal
```
