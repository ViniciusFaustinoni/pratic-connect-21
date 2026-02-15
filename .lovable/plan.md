
# Incluir valor da cota de coparticipacao na mensagem do link de auto vistoria (edge function)

## Problema

A mensagem enviada pela edge function `aprovar-solicitacao-ia` ao associado nao inclui o valor da cota de coparticipacao. O `cron-contato-sinistro` ja faz isso corretamente, buscando o plano do associado, percentual e valor FIPE do veiculo para calcular.

A mensagem atual enviada pelo `aprovar-solicitacao-ia` e generica e nao menciona valores.

## Solucao

### Arquivo: `supabase/functions/aprovar-solicitacao-ia/index.ts` (linhas 296-316)

Antes de montar a mensagem WhatsApp, buscar os dados necessarios para calcular a coparticipacao (mesmo padrao do `cron-contato-sinistro`):

1. Buscar o `plano_id` do associado e o `valor_fipe` + `uso_aplicativo` do veiculo
2. Buscar o plano com campos `cota_participacao`, `cota_minima`, `cota_app_percent`, `cota_app_min`
3. Calcular: `valorCota = Math.max(valorFipe * percentual / 100, minimo)`
4. Incluir na mensagem:
   - Percentual da cota
   - Valor FIPE do veiculo
   - Valor calculado da cota de coparticipacao

### Mensagem atualizada

```
Ola [nome]!

Seu sinistro [protocolo] foi registrado com sucesso.

Para dar andamento ao processo, acesse o link abaixo e envie os documentos necessarios:

[link]

*DOCUMENTOS NECESSARIOS:*

📸 *Etapa 1 - Auto Vistoria (fotos do veiculo)*
- Frente, traseira, laterais e teto
- Detalhes dos danos
- Painel/hodometro
- Minimo de 5 fotos

📋 *Etapa 2 - Boletim de Ocorrencia*
- Numero do B.O.
- Foto ou PDF do documento

📝 *Etapa 3 - Relato do ocorrido*
- Descricao detalhada do que aconteceu
- Audio ou texto
- Localizacao do evento

💰 *Cota de coparticipacao:*
Seu plano: [nome_plano] ([percentual]% da FIPE)
Valor FIPE do veiculo: R$ [valor_fipe]
Sua cota: *R$ [valor_cota]*

O link e valido por 72 horas.

ABP PraticCar
```

### Tambem atualizar: `src/pages/eventos/SinistroAnalise.tsx` (linha 319)

A mensagem do botao manual "Enviar Link de Auto Vistoria" tambem precisa incluir o valor da coparticipacao. Para isso:

1. Buscar `plano_id` do associado e dados do veiculo (valor_fipe, uso_aplicativo)
2. Buscar o plano com campos de cota
3. Calcular e incluir na mensagem -- mesma logica

## Detalhes tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Antes de montar a mensagem (linha ~296), buscar plano + veiculo para calcular coparticipacao e incluir valores na mensagem WhatsApp |
| `src/pages/eventos/SinistroAnalise.tsx` | No handler `handleEnviarLinkAutoVistoria` (linha ~300), buscar plano + veiculo e incluir coparticipacao na mensagem |

A logica de calculo segue o padrao existente no `cron-contato-sinistro`:
```typescript
// Buscar plano
const { data: plano } = await supabase
  .from("planos")
  .select("nome, cota_participacao, cota_minima, cota_app_percent, cota_app_min")
  .eq("id", associado.plano_id)
  .single();

// Calcular cota
let percentual = plano.cota_participacao;
let minimo = plano.cota_minima;
if (veiculo.uso_aplicativo && plano.cota_app_percent) {
  percentual = plano.cota_app_percent;
  minimo = plano.cota_app_min;
}
const valorCota = Math.max(valorFipe * percentual / 100, minimo);
```
