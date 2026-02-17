
# Enviar Link do Evento com Detalhes de Cota via WhatsApp (Pre-Analise)

## Contexto

O diretor ja acessa a pagina de detalhe do sinistro clicando na lista de pre-analise. Nessa pagina, o componente `EventoLinkCard` exibe o link do evento e tem um botao "Enviar via WhatsApp". Porem, a mensagem enviada e generica -- nao inclui o valor da cota de coparticipacao nem detalhes financeiros.

Ja existe uma funcao `handleEnviarLinkAutoVistoria` no `SinistroAnalise.tsx` que calcula a cota e envia uma mensagem completa, mas ela gera um link novo (nao reenvia o existente).

## Mudancas

### 1. Adicionar props de cota ao `EventoLinkCard`

**Arquivo: `src/components/eventos/EventoLinkCard.tsx`**

Adicionar props opcionais para dados financeiros:
- `valorFipe?: number`
- `cotaPercentual?: number`
- `cotaValor?: number`
- `planoNome?: string`

### 2. Incluir cota na mensagem WhatsApp do `EventoLinkCard`

**Arquivo: `src/components/eventos/EventoLinkCard.tsx`**

Alterar a funcao `handleWhatsApp` (linha 62-113) para incluir um bloco de cota na mensagem quando os dados estiverem disponiveis:

```text
💰 *Cota de coparticipação:*
Seu plano: Essencial (4% da FIPE)
Valor FIPE do veículo: R$ 85.000,00
Sua cota: *R$ 3.400,00*
```

### 3. Passar dados de cota ao renderizar o componente

**Arquivo: `src/pages/eventos/SinistroAnalise.tsx`**

Na renderizacao do `EventoLinkCard` (linha 1702-1708), passar as props de cota. Os dados do veiculo e plano ja estao disponiveis no contexto da pagina (variaveis `veiculo` e `sinistro`). 

Buscar os dados do plano (cota_participacao, cota_minima, cota_app_percent, cota_app_min) e calcular o valor da cota para passa-lo como prop. Pode-se usar os dados ja carregados ou fazer uma query adicional ao plano do associado.

## Resultado

- O diretor clica em um evento na Pre-Analise
- Abre a pagina de detalhe do sinistro
- No card "Link do Evento", clica em "Enviar via WhatsApp"
- O associado recebe a mensagem com:
  - Passo a passo das etapas
  - Valor da cota de coparticipacao calculada
  - Link valido por 72h
- Nenhuma mudanca no fluxo existente -- apenas enriquecimento da mensagem

## Arquivos alterados

1. `src/components/eventos/EventoLinkCard.tsx` -- novas props + mensagem enriquecida
2. `src/pages/eventos/SinistroAnalise.tsx` -- passar dados de cota ao componente
