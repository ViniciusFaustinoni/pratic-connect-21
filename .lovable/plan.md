

# Criar Template Meta "comunicacao_sinistro" com Variáveis Dinâmicas

## Contexto

Atualmente, quando um sinistro é comunicado (`status === 'comunicado'`), o `notificar-sinistro` usa o template genérico `sinistro_aberto` com apenas 2 params (nome, protocolo). A mensagem rica com plano, FIPE, coparticipação, link do evento e próximos passos é enviada como texto livre — descartada fora da janela de 24h.

## Template

Nome: `comunicacao_sinistro` | Categoria: `UTILITY`

Corpo com 8 variáveis posicionais:

```
✅ Sinistro Registrado

Olá, {{1}}! Aqui é a Pratic Car.

Recebemos a comunicação do seu sinistro de {{2}}.

📋 Protocolo: {{3}}

💰 Sobre a cota de coparticipação:
Seu plano é {{4}}, com cota de {{5}}.
Valor FIPE do veículo: {{6}}
Sua cota de coparticipação: {{7}}

📝 Próximos passos obrigatórios:
1. Realizar auto vistoria (fotos do veículo)
2. Enviar Boletim de Ocorrência
3. Relato completo do ocorrido

⏰ Prazo: você tem 30 dias a partir da data do evento para concluir o processo.

Já é possível dar entrada no conserto do veículo.

Acesse o link abaixo para completar as etapas:
🔗 {{8}}

O link é válido por 72 horas.

Em caso de dúvidas, estamos à disposição!
```

| Var | Conteúdo | Exemplo |
|---|---|---|
| `{{1}}` | Nome completo do associado | MARCUS VINICIUS FAUSTINONI DE FREITAS |
| `{{2}}` | Tipo do sinistro | colisão |
| `{{3}}` | Protocolo | SIN-20260304-0016 |
| `{{4}}` | Nome do plano | SELECT ONE APLICATIVO (Passeio) |
| `{{5}}` | Percentual/regra da cota | 8% da FIPE |
| `{{6}}` | Valor FIPE formatado | R$ 69.531,00 |
| `{{7}}` | Valor da coparticipação | R$ 5.562,48 |
| `{{8}}` | Link do evento | https://pratic-connect-21.lovable.app/evento/xxx |

## Alterações

### 1. Migration SQL
Inserir template `comunicacao_sinistro` na tabela `whatsapp_meta_templates` com status `DRAFT`, 8 variáveis e exemplos.

### 2. `notificar-sinistro/index.ts`
Atualizar o bloco `if (status === 'comunicado')` (linha 305-307) para usar o novo template `comunicacao_sinistro` com 8 params dinâmicos em vez do genérico `sinistro_aberto` com 2 params:

```typescript
if (status === 'comunicado') {
  templateName = 'comunicacao_sinistro';
  templateParams = [
    associado.nome || primeiroNome,
    extras?.tipo_label || 'sinistro',
    sinistro.protocolo,
    extras?.plano_nome || 'seu plano',
    extras?.cota_percentual || 'conforme contrato',
    extras?.valor_fipe || '',
    extras?.valor_cota || '',
    extras?.link_evento || '',
  ];
}
```

Os valores `plano_nome`, `cota_percentual`, `valor_fipe`, `valor_cota` e `link_evento` precisam ser passados no objeto `extras` pelo chamador (já existem no fluxo de abertura de sinistro conforme memory de coparticipação dinâmica).

### 3. Re-deploy
Deploy da edge function `notificar-sinistro`.

**Nota**: Template criado como `DRAFT` — precisa ser enviado para aprovação na Meta Business Suite.

