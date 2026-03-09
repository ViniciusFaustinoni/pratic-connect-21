

# Criar Template Meta "cadastro_aprovado" com Variáveis Dinâmicas

## Problema

O template atual `boas_vindas_associado` tem apenas 2 variáveis (`{{1}}` nome, `{{2}}` placa) e uma mensagem genérica. A mensagem rica que aparece na screenshot (nome, placa, marca/modelo, cobertura, link) está hardcoded no `notificar-cliente` como texto livre — nunca chega ao associado via Meta porque é descartada fora da janela de 24h.

## Solução

### 1. Criar novo template `cadastro_aprovado` no banco

Corpo do template com 6 variáveis posicionais:

```
🎉 Bem-vindo à PRATIC!

Parabéns {{1}}! Seu cadastro foi aprovado! 🚗

📋 Veículo Protegido:
{{2}} - {{3}}

🛡️ Cobertura Ativa: {{4}}
⏳ Próximo Passo: {{5}}

📱 Acesse o link abaixo para criar sua conta no app PRATIC:
🔗 {{6}}

Após a instalação, sua Proteção 360º será ativada automaticamente!

Para qualquer dúvida, fale com nossa IA pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙
```

Variáveis:
- `{{1}}` = nome do associado
- `{{2}}` = placa
- `{{3}}` = marca + modelo
- `{{4}}` = tipo de cobertura (ex: "Roubo e Furto" ou "Proteção 360º")
- `{{5}}` = próximo passo (ex: "Instalação do rastreador" ou "Crie sua senha")
- `{{6}}` = link de acompanhamento

Migration SQL para inserir o template com status `DRAFT`.

### 2. Atualizar `notificar-cliente/index.ts`

No `META_TEMPLATE_MAP`, atualizar os 3 mapeamentos que usam `boas_vindas_associado`:

- `cadastro_aprovado` → template `cadastro_aprovado` com 6 params
- `proposta_aprovada_roubo_furto` → template `cadastro_aprovado` com cobertura "Roubo e Furto", próximo passo "Instalação do rastreador"
- `proposta_aprovada_cobertura_total` → template `cadastro_aprovado` com cobertura "Proteção 360º", próximo passo "Crie sua senha e acesse o App"

Os dados (`placa`, `marca`, `modelo`, `link_acompanhamento`) já são passados pelo chamador via `dados`.

### 3. Re-deploy

Deploy da edge function `notificar-cliente` e execução da migration.

**Nota**: O template será inserido como `DRAFT`. Após criado, ele precisa ser enviado para aprovação da Meta pelo painel de templates antes de funcionar em produção.

