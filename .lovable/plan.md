

# Plano: Link Publico de Substituicao + Fix Loop Infinito

## Contexto

O fluxo de substituicao atual roda somente dentro do painel admin (`/cadastro/associados/:id/substituicao`). O pedido e criar uma versao publica com layout identico ao da cotacao (`CotacaoContratacao.tsx`), onde o associado completa as etapas de vistoria, beneficios, financeiro e conclusao. Ha tambem um bug de loop infinito na etapa atual.

## Bug: Loop Infinito

O `StepVistoria.tsx` usa `refetchInterval` (linha 90-94) que faz polling a cada 10s. Quando `veiculoNovoId` e `null` (o que acontece se o state se perde em recarregamento), a query retorna `null`, o polling nunca para, e o componente re-renderiza infinitamente tentando criar vistoria sem `veiculoNovoId`. Alem disso, o `AgendamentoCotacao` pode re-disparar `onConfirmar` causando loop de mutacoes.

**Correcao**: Desabilitar polling quando `veiculoNovoId` e null e adicionar guard no `criarVistoriaAutovistoria`.

## Banco de Dados

**Migration**: Adicionar coluna `token_publico` na tabela `substituicoes_veiculo`:

```text
ALTER TABLE substituicoes_veiculo
  ADD COLUMN IF NOT EXISTS token_publico VARCHAR(36) UNIQUE DEFAULT gen_random_uuid()::varchar;

-- Politica anon para acesso via token
CREATE POLICY "anon_select_by_token" ON substituicoes_veiculo
  FOR SELECT TO anon
  USING (token_publico IS NOT NULL);

-- Politica anon para update limitado (status de vistoria)
CREATE POLICY "anon_update_by_token" ON substituicoes_veiculo
  FOR UPDATE TO anon
  USING (token_publico IS NOT NULL)
  WITH CHECK (token_publico IS NOT NULL);
```

## Arquitetura do Link Publico

O associado recebe um link no formato `/substituicao/:token`. Esse link carrega os dados da substituicao via `token_publico` e apresenta as etapas relevantes no layout premium da cotacao.

**Convergencia com nova adesao**: As etapas de Vistoria, Pagamento e Acompanhamento reutilizam os mesmos componentes da cotacao publica (`EtapaVistoria`, `EtapaPagamentoCotacao`, `AgendamentoVistoriaCompleta`).

```text
Fluxo interno (admin)           Fluxo publico (associado)
─────────────────────           ─────────────────────────
1. Elegibilidade                (nao se aplica)
2. Evento Ativo                 (nao se aplica)
3. Rastreador                   (nao se aplica)
4. Novo Veiculo                 1. Resumo (readonly)
5. Vistoria              ───►   2. Vistoria (EtapaVistoria)
6. Beneficios                   3. Beneficios (readonly)
7. Financeiro             ───►  4. Pagamento (EtapaPagamentoCotacao)
8. Conclusao              ───►  5. Acompanhamento
```

## Arquivos

### Criados

1. **Migration SQL** — `token_publico` + politicas anon
2. **`src/pages/public/SubstituicaoPublica.tsx`** — Pagina publica com layout premium (header com logo, vehicle info bar, stepper). Carrega substituicao via token, determina etapa baseada no status, renderiza steps publicos.
3. **`src/hooks/useSubstituicaoPublica.ts`** — Hook que busca `substituicoes_veiculo` por `token_publico` (via anon), com realtime subscription para atualizar status.

### Modificados

4. **`src/App.tsx`** — Adicionar rota publica `<Route path="/substituicao/:token" element={<SubstituicaoPublica />} />`
5. **`src/components/substituicao/StepVistoria.tsx`** — Fix loop: desabilitar `refetchInterval` quando `veiculoNovoId` e null; guard no mutate
6. **`src/pages/cadastro/SubstituicaoVeiculoPage.tsx`** — Apos step financeiro, exibir botao "Copiar link do associado" com URL `/substituicao/:token` e botao "Abrir link" para o admin compartilhar
7. **`src/hooks/useSubstituicaoVeiculo.ts`** — Retornar `token_publico` no resultado de `useIniciarSubstituicao`

### Detalhes da pagina publica

A `SubstituicaoPublica.tsx` seguira o mesmo layout de `CotacaoContratacao.tsx`:
- Header premium com logo PRATIC
- Vehicle info bar (veiculo antigo → veiculo novo)
- Stepper horizontal com 3-4 etapas (Vistoria, Pagamento, Acompanhamento)
- Cards com backdrop-blur e animacoes framer-motion
- Sem referencia a rotas internas do sistema
- Steps da cotacao publica sao reutilizados diretamente

