

## Análise do Template para Meta

O template que você enviou é essencialmente o que já está configurado como **fallback Evolution API** na `notificar-cliente` (linhas 46-60). Porém, para a **Meta oficial**, o evento `cobertura_total_ativada` atualmente **reutiliza** o template genérico `cadastro_aprovado_botao` — não tem template próprio.

### Template adaptado para aprovação na Meta

O corpo precisa usar variáveis no formato `{{1}}`, `{{2}}` etc. Recomendo esta estrutura:

**Nome do template**: `cobertura_total_ativada`
**Categoria**: UTILITY
**Idioma**: pt_BR

**Corpo**:
```
🛡️ Cobertura Total Ativada!

Parabéns {{1}}! Seu veículo {{2}} ({{3}}) agora está com COBERTURA TOTAL ativa! ✅

O que está incluso na sua cobertura:

🔐 Roubo e Furto
💥 Colisão
🔥 Incêndio
🌧️ Fenômenos Naturais
🚗 Assistência 24h (guincho, pane seca, chaveiro e mais)
📍 Rastreamento em tempo real

Acesse o App PRATIC para acompanhar seu veículo e solicitar assistência quando precisar.

Bem-vindo à família PRATIC! 💙
```

**Variáveis de exemplo**:
- `{{1}}` = Marcus (nome)
- `{{2}}` = LMS3B44 (placa)
- `{{3}}` = Fiat Uno (marca/modelo)

**Botão** (opcional): URL dinâmica para o app, como no `cadastro_aprovado_botao`

### Alterações no código

**1. Criar o template no banco** (`whatsapp_meta_templates`):
- Inserir registro com nome `cobertura_total_ativada`, categoria `UTILITY`, corpo acima, status `DRAFT`
- Submeter para aprovação via interface existente

**2. Atualizar mapeamento em `notificar-cliente/index.ts`** (linha 364-372):
- Trocar `template_name` de `'cadastro_aprovado_botao'` para `'cobertura_total_ativada'`
- Ajustar `getParams` para enviar 3 variáveis: `[primeiroNome, placa, marcaModelo]`
- Remover ou ajustar `getButtonParams` conforme o template tenha ou não botão

### Fluxo de implementação

1. Primeiro: criar o template no banco e enviar para aprovação da Meta pela interface de gestão
2. Após aprovação: atualizar o mapeamento na Edge Function para usar o template dedicado
3. Enquanto aguarda aprovação, o sistema continua funcionando com `cadastro_aprovado_botao` como fallback

