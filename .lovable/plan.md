

# Recriar template `boas_vindas_associado_v2` no banco de dados

## Problema
O template `boas_vindas_associado` foi completamente removido do banco de dados (provavelmente pela sincronização com a Meta após a exclusão). A migração anterior que renomeava para `_v2` não encontrou nenhum registro para atualizar. Resultado: o template não existe em lugar nenhum.

As edge functions (`ativar-associado`, `notificar-cliente`) já referenciam `boas_vindas_associado_v2`, mas não há registro no banco para submeter à Meta.

## Solução

### 1. SQL Migration — Inserir o template completo

Inserir um novo registro em `whatsapp_meta_templates` com:
- **Nome**: `boas_vindas_associado_v2`
- **Status**: `DRAFT` (para ser enviado para aprovação)
- **Corpo**: O texto exato aprovado anteriormente com 4 variáveis (`{{1}}` a `{{4}}`)
- **Botões**: Um botão URL dinâmico para criar conta no app
- **Variáveis exemplo**: Valores de exemplo para cada variável
- **Rodapé**: Texto de rodapé padrão

```sql
INSERT INTO whatsapp_meta_templates (
  nome, categoria, idioma, status, header_tipo,
  corpo, rodape, botoes, variaveis_exemplo
) VALUES (
  'boas_vindas_associado_v2',
  'UTILITY',
  'pt_BR',
  'DRAFT',
  'none',
  '🎉 Bem-vindo à PRATIC!

Parabéns {{1}}! Seu cadastro foi aprovado! 🚗

📋 Veículo Protegido:
{{2}}

🛡️ Cobertura Ativa: {{3}}

⏳ Próximo Passo: {{4}}

📱 Acesse o botão abaixo para criar sua conta no app PRATIC.

Após a instalação, sua Proteção 360º será ativada automaticamente!

Para qualquer dúvida sobre sua cobertura, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙',
  'PRATIC - Proteção Veicular',
  '[{"type":"URL","text":"📱 Criar Conta no App","url":"https://pratic-connect-21.lovable.app/primeiro-acesso?id={{1}}","example":"https://pratic-connect-21.lovable.app/primeiro-acesso?id=abc123"}]',
  '{"1":"João","2":"ABC-1234 - Fiat Uno","3":"Roubo e Furto","4":"Instalação do rastreador"}'
);
```

### Resultado
- Template aparece como DRAFT na aba de Templates Meta
- Usuário clica "Enviar para aprovação" para submeter à Meta
- Após aprovação, as edge functions (`ativar-associado`, `notificar-cliente`) que já usam o nome `boas_vindas_associado_v2` passarão a funcionar corretamente com as 4 variáveis + botão URL

