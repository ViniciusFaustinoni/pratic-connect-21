

# Criar Template Meta "tecnico_a_caminho" com Variáveis Dinâmicas

## Template

Nome: `tecnico_a_caminho` | Categoria: `UTILITY`

Corpo com 7 variáveis posicionais:

```
🚗 Técnico a Caminho!

Olá {{1}}! Nosso técnico está a caminho do seu endereço para realizar a instalação do rastreador.

👤 Técnico: {{2}}
📞 Contato: {{3}}
💬 WhatsApp: {{4}}
📍 Endereço: {{5}}
⏰ Período: {{6}}

{{7}}
```

| Variável | Conteúdo | Exemplo |
|---|---|---|
| `{{1}}` | Nome do associado | Marcus |
| `{{2}}` | Nome do técnico | Vistoriador |
| `{{3}}` | Telefone do técnico | (21) 99259-3830 |
| `{{4}}` | Link WhatsApp do técnico | https://wa.me/5521992593830 |
| `{{5}}` | Endereço completo | EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO |
| `{{6}}` | Período agendado | Manhã (08:00-12:00) |
| `{{7}}` | Mensagem adicional | Você pode entrar em contato com o técnico se precisar! |

## Alterações

### 1. Migration SQL
Inserir o template `tecnico_a_caminho` na tabela `whatsapp_meta_templates` com status `DRAFT`.

### 2. `notificar-cliente/index.ts`
Atualizar o `META_TEMPLATE_MAP` — substituir o mapeamento atual de `tecnico_em_rota` (que usa `assistencia_confirmada` com 3 params genéricos) pelo novo template `tecnico_a_caminho` com 7 params dinâmicos:

```typescript
tecnico_em_rota: {
  template_name: 'tecnico_a_caminho',
  getParams: () => [
    primeiroNome,
    dados?.tecnico_nome || 'Técnico PRATIC',
    dados?.tecnico_telefone || '',
    dados?.tecnico_whatsapp_link || '',
    dados?.endereco || 'Endereço a confirmar',
    dados?.periodo || 'A confirmar',
    'Você pode entrar em contato com o técnico se precisar de mais informações!',
  ],
},
```

### 3. Re-deploy
Deploy da edge function `notificar-cliente`.

**Nota**: Após criado, o template precisa ser enviado para aprovação na Meta Business Suite.

