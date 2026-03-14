

# Solicitar Email Antes do Envio para Autentique

## Problema
Na cotação rápida, o email é opcional. Porém, o Autentique **exige** email do signatário para enviar o link de assinatura. Se `email_solicitante` estiver vazio, o fluxo falha silenciosamente.

## Solução
Adicionar uma sub-etapa de coleta de email dentro de `EtapaAssinaturaContrato` quando `clienteEmail` estiver vazio. O email informado será salvo na cotação antes de prosseguir com a geração do contrato.

## Alterações

### `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`
- Adicionar estado `emailLocal` e sub-etapa `'coletar_email'`
- No `useEffect` de inicialização: se `clienteEmail` estiver vazio, mostrar formulário de email em vez de iniciar o fluxo
- Formulário simples: campo de email com validação + botão "Continuar"
- Ao submeter: salvar email na `cotacoes` (`email_solicitante`) via `publicSupabase` e prosseguir com o fluxo normal
- O email coletado será usado em todo o restante do componente (exibição do signatário, envio ao Autentique)

### Fluxo atualizado
```text
EtapaAssinaturaContrato monta
       │
       ├─ clienteEmail preenchido? → fluxo normal (verificar/gerar contrato)
       │
       └─ clienteEmail vazio? → tela "Informe seu email"
              │
              ├─ Usuário digita email válido
              ├─ Salva em cotacoes.email_solicitante
              └─ Inicia fluxo normal com email preenchido
```

### UI do formulário de email
- Card com ícone de `Mail`
- Título: "Email necessário para assinatura"
- Descrição: "Para enviar o contrato digital, precisamos do seu email"
- Input de email com validação básica (regex)
- Botão "Continuar para assinatura"

