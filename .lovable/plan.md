

# Correção: Variáveis incorretas no template `assistencia_confirmada`

## Diagnóstico

O template aprovado na Meta tem o corpo:
```
Olá {{1}}, seu pedido de assistência foi confirmado. O prestador {{2}} está a caminho e chegará em aproximadamente {{3}} minutos.
```

Onde: `{{1}}` = nome, `{{2}}` = prestador, `{{3}}` = **tempo estimado em minutos**

### Mapeamento dos erros encontrados

| Arquivo | Valor passado em {{3}} | Correto? | Problema |
|---|---|---|---|
| `atribuir-proxima-tarefa` L939 | `servico.bairro` ("Marechal Hermes") | **BUG** | Bairro no lugar do tempo |
| `notificar-status-assistencia` L229 | `dadosTemplate.protocolo` | **BUG** | Protocolo no lugar do tempo |
| `disparar-notificacao` L383 | `dados.tempo \|\| '30'` | OK | Correto |
| `notificar-cliente` L352 | `dados.periodo \|\| '30'` | OK | Correto |
| `notificar-retirada-whatsapp` L58 | `"25/03/2026 (manhã)"` | **MISUSO** | Template errado para retirada |
| `notificar-manutencao-whatsapp` L62 | `"25/03/2026 (manhã)"` | **MISUSO** | Template errado para manutenção |

A screenshot do usuário confirma: "está a caminho e chegará em aproximadamente **Marechal Hermes** minutos" — vem de `atribuir-proxima-tarefa`.

## Correções

### 1. `atribuir-proxima-tarefa/index.ts` (L936-941)
Trocar `servico.bairro` por tempo estimado (`'30'` como default). A informação de bairro já está no texto livre da mensagem.

```typescript
template_params: [
  profissionalTel?.nome || 'Profissional',
  `${tipoServicoLabelVist} - ${servico.associado_nome || 'Cliente'}`,
  '30',  // tempo estimado em minutos
],
```

### 2. `notificar-status-assistencia/index.ts` (L226-230)
Trocar `dadosTemplate.protocolo` por tempo estimado.

```typescript
template_params: [
  nomeAssociado,
  dadosTemplate.prestador_nome as string || 'Praticcar',
  '30',  // tempo estimado em minutos
],
```

### 3. `notificar-retirada-whatsapp/index.ts` (L54-59)
Este template NÃO é de assistência — é notificação de retirada de equipamento. Deveria usar um template próprio, mas como não existe um aprovado na Meta, a correção imediata é **não enviar template** e usar apenas texto livre com `allow_text: true` (dentro da janela 24h), ou ajustar os params para fazer sentido mínimo no template existente.

Correção pragmática: usar `allow_text: true` para enviar como texto livre.

### 4. `notificar-manutencao-whatsapp/index.ts` (L58-63)
Mesmo caso — notificação de manutenção usando template de assistência. Mesma correção: `allow_text: true`.

### Re-deploy
As 4 Edge Functions serão re-deployadas após as correções.

