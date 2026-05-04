## Ajustar texto da mensagem de WhatsApp da suspensão por não-instalação

Substituir o texto atual (em ambos os pontos onde é gerado) pela versão exata solicitada pelo usuário, mantendo as variáveis dinâmicas já disponíveis (primeiro nome, placa, prazo em horas).

### Texto novo (único, padronizado)

```
Olá {primeiroNome}! ⚠️ A cobertura ( Roubo e Furto ) do seu veículo {placa} foi suspensa temporariamente porque a instalação do rastreador não foi realizada dentro do prazo de {prazoHoras}h após a assinatura do contrato. 🚫 Você está sem cobertura de roubo e furto enquanto a instalação não for concluída. Assim que a instalação for finalizada, a cobertura volta automaticamente.
```

- `{primeiroNome}` = `assoc.nome?.split(' ')[0] ?? ''`
- `{placa}` = `veiculo.placa ?? veiculo.modelo ?? ''`
- `{prazoHoras}` = variável `prazoHoras` já calculada (48h/72h conforme UF)

### Arquivos a editar

1. `supabase/functions/cron-suspender-cobertura-inativacao/index.ts` (linhas ~151-157) — substituir bloco `msg = ...` pelo novo texto.
2. `supabase/functions/suspender-cobertura-instalacao-manual/index.ts` (linhas ~169-175) — mesmo ajuste.

Nenhuma outra lógica é alterada: trigger de reativação, fluxo de cobrança, auditoria e payload do `enviar-whatsapp` (`tipo: 'suspensao_instalacao_prazo'`) permanecem iguais.

### Deploy

Após a edição, redeployar as duas edge functions:
- `cron-suspender-cobertura-inativacao`
- `suspender-cobertura-instalacao-manual`