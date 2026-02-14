

# Fluxo Completo de Roubo e Furto -- Implementacao

## Visao Geral

Implementar o fluxo diferenciado de roubo/furto conforme as regras de negocio, que diverge fundamentalmente do fluxo de colisao: nao existe veiculo para fotografar, nao existe vistoria presencial, e o destino final pode ser recuperacao do veiculo ou indenizacao integral.

## O que ja existe

- Registro do sinistro com validacoes (NovoSinistroModal) -- OK
- Acionamento do rastreador via edge function `acionar-roubo-furto` -- OK
- Card de acionamento na tela de detalhe (CardAcionamentoRoubo) -- OK
- Modal de registrar recuperacao (RegistrarRecuperacaoModal) com encerramento do acionamento -- OK
- Status `em_recuperacao` no workflow com transicoes para `em_regulacao`, `aguardando_pagamento` e `encerrado` -- OK
- Botao "Acionar Recuperacao" no dropdown de acoes do detalhe -- OK

## O que falta implementar

### 1. Acionamento automatico do rastreador ao registrar roubo/furto

Atualmente, ao registrar um sinistro de roubo/furto, o sistema NAO aciona o rastreador automaticamente. O operador precisa ir no detalhe e clicar "Acionar Recuperacao" manualmente. Pela regra, o acionamento deve ser IMEDIATO.

**Arquivo:** `src/components/eventos/NovoSinistroModal.tsx`
- Apos o insert do sinistro (passo 6, junto com o reboque), invocar `supabase.functions.invoke('acionar-roubo-furto')` automaticamente quando o tipo for `roubo` ou `furto`.

### 2. Link 1 simplificado para roubo/furto (sem fotos do veiculo, sem vistoria)

Atualmente o EventoLinkCard so aparece para `colisao` (linha 927 do SinistroDetalhe). Para roubo/furto o Link 1 deve aparecer com etapas diferentes:
- Etapa 1: B.O. (obrigatorio e imediato)
- Etapa 2: Relato do ocorrido
- Etapa 3: Chaves (apenas furto) + Documentacao complementar (CRV, CRLV, IPVA, certidao negativa, extrato DETRAN)

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`
- Remover a condicao `sinistro.tipo === 'colisao'` do EventoLinkCard
- Exibir para todos os tipos, incluindo roubo/furto

**Arquivo:** `src/components/eventos/EventoLinkCard.tsx`
- Adaptar as labels das etapas conforme o tipo do sinistro (colisao vs roubo/furto)

### 3. Verificacoes de fraude automaticas na analise

Quando o analista abre um sinistro de roubo/furto, o sistema deve exibir automaticamente alertas baseados no historico do rastreador:
- Velocidade zero + desconexao = possivel fraude
- Locais suspeitos nos dias anteriores
- Mudanca de rotina
- Rastreador nao instalado quando obrigatorio

**Novo componente:** `src/components/sinistros/AlertasFraudeRoubo.tsx`
- Card que aparece no detalhe do sinistro para roubo/furto
- Busca dados do rastreador (ultima comunicacao, historico de posicoes)
- Exibe alertas visuais com icones de risco

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`
- Incluir o AlertasFraudeRoubo na coluna lateral para sinistros roubo/furto

### 4. Status `em_recuperacao` com contagem de dias e cenarios

Apos aprovacao, sinistros de roubo/furto devem ir para `em_recuperacao` (ja existe no workflow). Faltam:

**4a. Card de acompanhamento de recuperacao:**

**Novo componente:** `src/components/sinistros/CardRecuperacaoStatus.tsx`
- Exibe contagem de dias desde o roubo/furto
- Barra de progresso ate 30 dias
- Indicador visual: "verde" (primeiros dias), "amarelo" (proximos do prazo), "vermelho" (prazo esgotado)
- Botoes de acao: "Registrar Recuperacao" ou "Iniciar Indenizacao"

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`
- Exibir CardRecuperacaoStatus quando status === `em_recuperacao`

**4b. Logica dos cenarios de recuperacao no RegistrarRecuperacaoModal:**

**Arquivo:** `src/hooks/useRegistrarRecuperacao.ts`
- Apos registrar recuperacao, atualizar o STATUS DO SINISTRO baseado na condicao:
  - `integro` (sem dano) → status `encerrado` + historico "Veiculo recuperado integro, desonerado"
  - `avariado` (< 75% FIPE) → status `em_regulacao` + segue fluxo de oficina como colisao
  - `destruido` (>= 75% FIPE) → status `aguardando_pagamento` + marca como indenizacao integral

### 5. Fluxo de indenizacao integral (nao recuperado apos 30 dias)

**5a. Botao "Iniciar Indenizacao" no CardRecuperacaoStatus:**
- Muda status para `aguardando_pagamento`
- Cria documentos de indenizacao pendentes (CRV preenchido, procuracao publica, etc.)
- Notifica o associado com link para enviar documentacao

**Novo componente:** `src/components/sinistros/IniciarIndenizacaoModal.tsx`
- Confirma inicio do processo de indenizacao
- Calcula valor FIPE com depreciacoes (chassi remarcado -30%, app -25%, leilao -30%, avarias -20%)
- Registra no historico
- Define prazo de 60 dias uteis para pagamento

**5b. Documentos de indenizacao:**

Adicionar ao `DOCUMENTOS_OBRIGATORIOS` no NovoSinistroModal (ou extrair para constante compartilhada):
```
indenizacao: [
  { tipo: 'crv_transferencia', nome: 'CRV preenchido a favor da Pratic', obrigatorio: true },
  { tipo: 'procuracao_publica', nome: 'Procuracao Publica', obrigatorio: true },
  { tipo: 'quitacao_financiamento', nome: 'Comprovante Quitacao Financiamento', obrigatorio: false },
  { tipo: 'certidao_negativa_furto', nome: 'Certidao Negativa de Furto', obrigatorio: true },
  { tipo: 'extrato_detran', nome: 'Extrato DETRAN com queixa', obrigatorio: true },
]
```

### 6. Painel "Veiculos Nao Recuperados"

**Novo componente:** `src/components/sinistros/PainelNaoRecuperados.tsx`
- Lista todos os sinistros em `em_recuperacao` com contagem de dias
- Destaque visual para os que ultrapassaram 30 dias
- Acoes rapidas: "Iniciar Indenizacao", "Ver Detalhe"

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx` ou `src/pages/eventos/SinistrosList.tsx`
- Adicionar aba ou filtro rapido "Nao Recuperados" na lista de sinistros

## Resumo Visual do Fluxo Implementado

```text
REGISTRO ROUBO/FURTO
    |
    +-- Acionamento automatico do rastreador
    +-- Documentos: B.O. + Relato + Chaves(furto) + Docs complementares
    |
    v
EM ANALISE (alertas de fraude automaticos)
    |
    +-- Suspeita → EM SINDICANCIA (30 dias)
    |
    v
APROVADO → EM RECUPERACAO (contagem 30 dias)
    |
    +-- Recuperado integro → ENCERRADO (desonerado)
    +-- Recuperado avariado (<75%) → EM REGULACAO → fluxo oficina
    +-- Recuperado destruido (>=75%) → AGUARDANDO PAGAMENTO → indenizacao
    +-- NAO recuperado (30 dias) → AGUARDANDO PAGAMENTO → indenizacao
    |
    v
INDENIZACAO: Docs → Analise → 60 dias uteis → Pagamento → ENCERRADO
```

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/eventos/NovoSinistroModal.tsx` |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` |
| Modificar | `src/components/eventos/EventoLinkCard.tsx` |
| Modificar | `src/hooks/useRegistrarRecuperacao.ts` |
| Criar | `src/components/sinistros/AlertasFraudeRoubo.tsx` |
| Criar | `src/components/sinistros/CardRecuperacaoStatus.tsx` |
| Criar | `src/components/sinistros/IniciarIndenizacaoModal.tsx` |
| Criar | `src/components/sinistros/PainelNaoRecuperados.tsx` |

## Ordem de Implementacao

1. Acionamento automatico do rastreador (NovoSinistroModal)
2. Link 1 para roubo/furto (SinistroDetalhe + EventoLinkCard)
3. Alertas de fraude (AlertasFraudeRoubo + SinistroDetalhe)
4. Card de recuperacao com contagem (CardRecuperacaoStatus + SinistroDetalhe)
5. Logica de cenarios no RegistrarRecuperacao (useRegistrarRecuperacao)
6. Fluxo de indenizacao (IniciarIndenizacaoModal + documentos)
7. Painel de nao recuperados (PainelNaoRecuperados + SinistrosList)

