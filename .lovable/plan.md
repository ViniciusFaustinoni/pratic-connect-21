
# Fluxo de Pre-Analise e Restricao de Acesso do Analista de Eventos

## Resumo

Implementar duas mudancas:

1. **Analista de eventos NAO ve eventos antes da vistoria do regulador ser concluida** -- a fila e o detalhe continuam filtrando apenas `aguardando_analise` (ja funciona assim). No dashboard, adicionar apenas um contador informativo "Pendente Vistoria" (numero, sem acesso).

2. **Nova area "Eventos > Pre-Analise" no menu lateral, visivel apenas para Diretor** -- uma pagina que lista sinistros nos status pre-vistoria (`comunicado`, `em_analise`, `documentacao_pendente`, `pendente_vistoria_regulador`) para que o diretor acompanhe o pipeline antes do analista ser acionado.

## Alteracoes

### 1. Hook de contadores — `src/hooks/useEventosAnalise.ts`

Adicionar query para contar sinistros com `status` IN (`comunicado`, `em_analise`, `documentacao_pendente`, `pendente_vistoria_regulador`):

```typescript
const pendentesVistoria = await supabase
  .from('sinistros')
  .select('id', { count: 'exact', head: true })
  .in('status', ['comunicado', 'em_analise', 'documentacao_pendente', 'pendente_vistoria_regulador']);
```

Retornar `pendentesVistoria: pendentesVistoria.count || 0` no objeto de contadores.

### 2. Dashboard do Analista — `src/pages/analista-eventos/AnalistaEventosHome.tsx`

Adicionar card informativo "Pendente Vistoria":
- Icone: `Eye` (lucide-react)
- Cor: roxo (`text-purple-600 bg-purple-100`)
- Posicionar como primeiro card no grid
- Apenas informativo, sem link ou clique

### 3. Nova pagina "Pre-Analise" — `src/pages/eventos/EventosPreAnalise.tsx`

Pagina acessivel apenas pelo Diretor que lista sinistros em fase pre-vistoria:
- Buscar sinistros com status IN (`comunicado`, `em_analise`, `documentacao_pendente`, `pendente_vistoria_regulador`)
- Exibir tabela com: protocolo, tipo, associado, veiculo, placa, status, data de criacao
- Badges coloridas por sub-status (comunicado = amarelo, pendente_vistoria = roxo, etc.)
- Clicar no sinistro navega para `/eventos/sinistros/:id` (detalhe existente do diretor)
- Filtros por status e tipo

### 4. Rota e menu — `src/App.tsx` e `src/components/layout/AppSidebar.tsx`

**App.tsx**: Adicionar rota `/eventos/pre-analise` apontando para `EventosPreAnalise`.

**AppSidebar.tsx**: Adicionar item "Pre-Analise" no grupo "Eventos" do menu lateral, com permissao `isDiretor` para que apenas diretores vejam.

## O que NAO muda

- A fila do analista (`AnalistaEventosFila.tsx`) continua mostrando APENAS `aguardando_analise`
- A tela de detalhe do analista (`EventoAnaliseDetalhe.tsx`) continua sem alteracoes -- acoes ja bloqueadas para status diferente de `aguardando_analise`
- Todos os dados existentes na analise (fotos, GPS, orcamento, documentos, vistoria do regulador) continuam sendo exibidos normalmente apos a vistoria ser concluida

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useEventosAnalise.ts` | Adicionar contador `pendentesVistoria` |
| `src/pages/analista-eventos/AnalistaEventosHome.tsx` | Novo card informativo "Pendente Vistoria" |
| `src/pages/eventos/EventosPreAnalise.tsx` | Nova pagina com lista de eventos pre-vistoria (apenas diretor) |
| `src/App.tsx` | Nova rota `/eventos/pre-analise` |
| `src/components/layout/AppSidebar.tsx` | Novo item "Pre-Analise" no menu Eventos (apenas diretor) |
