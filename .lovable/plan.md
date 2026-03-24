

# Painel de Atribuição — Vistoriador Prestador (VP-M02)

## Resumo

Substituir o placeholder VP-M02 no card Instalador da página de detalhe por um painel completo de seleção, definição de valor e confirmação de atribuição a prestador, com envio de notificação via WhatsApp.

## 1. Migration SQL

Adicionar colunas à tabela `instalacoes`:

- `vistoriador_prestador_id` uuid FK → `vistoriadores_prestadores(id)`, nullable
- `valor_prestador` numeric(10,2), nullable
- `prestador_atribuido_em` timestamptz, nullable

## 2. Novo componente `PainelAtribuicaoPrestador.tsx`

`src/components/instalacoes/PainelAtribuicaoPrestador.tsx`

**Props**: `instalacao` (dados completos), `tipoCobertura` ('area_prestador' | 'fora_cobertura'), `cobertura` (dados do RPC com lista de prestadores)

**Estados do painel**:

- **Já atribuído** (`instalacao.vistoriador_prestador_id` preenchido): exibe nome, valor, badge "Aguardando execução", botão "Reenviar link por WhatsApp"
- **Seleção** (não atribuído):
  - Cabeçalho com título e badge de contexto (laranja/vermelho)
  - Cenário B: lista cards dos prestadores da cobertura
  - Cenário C: campo de busca + query de `vistoriadores_prestadores` filtrada por nome
  - Ao selecionar: destaque azul no card, campo "Valor desta tarefa (R$)" com autofocus
  - Botão "Atribuir e Notificar via WhatsApp" (desabilitado sem valor)
  - Modal de confirmação com resumo (nome, cidade, data, associado, valor, aviso sobre link)

**Ação de confirmação**: UPDATE na `instalacoes` com `vistoriador_prestador_id`, `valor_prestador`, `prestador_atribuido_em`. Envio WhatsApp via `abrirWhatsAppWeb` (fallback — link tokenizado será implementado em tarefa futura).

## 3. Editar `InstalacaoDetalhe.tsx`

No card Instalador (linhas ~420-431), substituir o placeholder VP-M02 pelo `<PainelAtribuicaoPrestador>`. Passar `instalacao`, `tipoCobertura` e `cobertura` como props. O hook `useCoberturaInstalacao` já retorna `cobertura`.

Ajustar a chamada do hook para capturar `cobertura`:
```
const { tipo: tipoCobertura, cobertura } = useCoberturaInstalacao({...});
```

Condição de "já atribuído": se `(instalacao as any).vistoriador_prestador_id` estiver preenchido, o painel renderiza o estado pós-confirmação diretamente.

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | **Criar** — 3 colunas em `instalacoes` |
| `src/components/instalacoes/PainelAtribuicaoPrestador.tsx` | **Criar** — Componente completo |
| `src/pages/monitoramento/InstalacaoDetalhe.tsx` | **Editar** — Integrar painel |

