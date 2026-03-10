

# Template Meta "comunicacao_sinistro" — Integrar nos envios

## Situação Atual

O template `comunicacao_sinistro` já existe no banco como DRAFT com 8 variáveis:
- `{{1}}` Nome, `{{2}}` Tipo sinistro, `{{3}}` Protocolo, `{{4}}` Plano, `{{5}}` % FIPE, `{{6}}` Valor FIPE, `{{7}}` Valor cota, `{{8}}` Link evento

Porém os 3 pontos de envio usam `sinistro_aberto` (apenas 2 params) ou texto livre:

| Função | Envio atual | Problema |
|---|---|---|
| `cron-contato-sinistro` | `sinistro_aberto` (2 params) | Template simples, ignora conteúdo rico |
| `aprovar-solicitacao-ia` | Texto livre (sem template) | Meta descarta fora da janela 24h |
| `disparar-notificacao` | `sinistro_aberto` (2 params) | Idem |

## Alterações

### 1. `cron-contato-sinistro/index.ts` (linhas ~197-209)
Substituir envio com `sinistro_aberto` por `comunicacao_sinistro` com 8 params:
```typescript
template_name: 'comunicacao_sinistro',
template_params: [
  primeiroNomeContato,
  tipoLabel,
  sinistro.protocolo,
  `${planoNome} (${categoriaVeiculo})`,
  `${percentual}% da FIPE`,
  formatCurrency(valorFipe),
  formatCurrency(valorCota),
  `${siteUrl}/evento/${token}`,
],
```

### 2. `aprovar-solicitacao-ia/index.ts` (linhas ~358-365)
Adicionar `template_name` e `template_params` ao envio (atualmente só envia texto livre):
```typescript
body: JSON.stringify({
  telefone: telefoneSin,
  mensagem: mensagemSin,
  template_name: 'comunicacao_sinistro',
  template_params: [primeiroNome, tipoLabel, protocolo, planoInfo, percInfo, fipeInfo, cotaInfo, linkUrl],
}),
```

### 3. `disparar-notificacao/index.ts` (linhas ~376-380)
Quando `tipo === 'sinistro'` e `subtipo === 'aberto'`, usar `comunicacao_sinistro` com os dados disponíveis:
```typescript
templateName = 'comunicacao_sinistro';
templateParams = [
  primeiroNome,
  String(dados.tipo_sinistro || ''),
  String(dados.protocolo || ''),
  String(dados.plano || ''),
  String(dados.percentual || ''),
  String(dados.valor_fipe || ''),
  String(dados.valor_cota || ''),
  String(dados.link_evento || ''),
];
```

### 4. Enviar template para aprovação da Meta
Após as alterações, o template `comunicacao_sinistro` precisa ser enviado para aprovação na Meta Business Suite (via botão "Enviar para aprovação" no painel ou pela API).

## Resumo

| Arquivo | Alteração |
|---|---|
| `cron-contato-sinistro/index.ts` | Usar `comunicacao_sinistro` com 8 params |
| `aprovar-solicitacao-ia/index.ts` | Adicionar template ao envio (era texto livre) |
| `disparar-notificacao/index.ts` | Trocar `sinistro_aberto` por `comunicacao_sinistro` |
| Meta Business Suite | Enviar template para aprovação |

