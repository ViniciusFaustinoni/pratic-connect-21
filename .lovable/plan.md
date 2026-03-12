

# Fix: Template `boas_vindas_associado` — conteúdo e variáveis

## Problema
O template atual tem apenas 2 variáveis (`{{1}}` nome, `{{2}}` veículo). A mensagem desejada precisa de **4 variáveis no corpo + 1 botão URL dinâmico**.

## Novo Template (adaptado para aprovação Meta)

**Corpo** (4 variáveis):
```
🎉 Bem-vindo à PRATIC!

Parabéns {{1}}! Seu cadastro foi aprovado! 🚗

📋 Veículo Protegido:
{{2}}

🛡️ Cobertura Ativa: {{3}}

⏳ Próximo Passo: {{4}}

📱 Acesse o botão abaixo para criar sua conta no app PRATIC.

Após a instalação, sua Proteção 360º será ativada automaticamente!

Para qualquer dúvida sobre sua cobertura, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙
```

**Botão URL**: `Acessar App PRATIC` → `https://pratic-connect-21.lovable.app/acompanhar/{{1}}`

> O link inline foi movido para um botão URL — Meta rejeita templates com URLs cruas no corpo.

## Alterações

### 1. Atualizar registro do template no banco (`whatsapp_meta_templates`)
- Atualizar o `corpo` com o novo texto (4 variáveis)
- Atualizar `botoes` com botão URL dinâmico
- Resetar `status` para `DRAFT` (precisa reenviar para aprovação)

### 2. `ativar-associado/index.ts` (~linha 293)
- Passar 4 body params + 1 button param:
  - `[primeiroNome, veiculoDescricao, cobertura, 'Instalação do rastreador']`
  - Button: `[associado.id]` (sufixo da URL)

### 3. `notificar-cliente/index.ts` (~linhas 322-354)
- Atualizar todos os 6 mapeamentos que usam `boas_vindas_associado`:
  - `cadastro_aprovado` → `[nome, veículo, cobertura, 'Instalação do rastreador', associadoId]`
  - `proposta_aprovada_roubo_furto` → `[nome, veículo, 'Roubo e Furto', 'Instalação do rastreador', associadoId]`
  - `proposta_aprovada_cobertura_total` → `[nome, veículo, 'Proteção 360º', 'Instalação do rastreador', associadoId]`
  - `cobertura_total_ativada` → `[nome, veículo, 'Proteção 360º', 'Proteção ativa!', associadoId]`
  - `vistoria_aprovada` → `[nome, veículo, cobertura, 'Aguardando instalação', associadoId]`
  - `instalacao_concluida` → `[nome, veículo, 'Proteção 360º', 'Proteção ativa!', associadoId]`
  - O 5º param (associadoId) será auto-split para o botão URL pelo `whatsapp-send-text`

### Resumo
- **1 update SQL** no template
- **2 edge functions** editadas e redeployadas
- Após deploy, o template precisará ser **reenviado para aprovação da Meta** pela interface de gestão

