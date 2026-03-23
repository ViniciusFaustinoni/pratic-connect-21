

# Plano: Corrigir Variáveis no Início/Fim dos Templates Meta

## Problema

A Meta rejeita templates onde variáveis `{{X}}` estão no início ou no final do corpo. Dois templates terminam com variável:

| Template | Problema |
|---|---|
| `boleto_gerado_v1` | Termina com `{{6}}` (linha digitável) |
| `lembrete_desconto_v1` | Termina com `{{3}}` (linha digitável) |

Nenhum template começa com variável (todos têm texto fixo antes).

## Correção

Adicionar texto fixo após a variável final em cada template:

**`boleto_gerado_v1`**: Após `{{6}}`, adicionar quebra de linha + o rodapé que já consta no template original da Julia:
```
{{6}}

ESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!
```

**`lembrete_desconto_v1`**: Após `{{3}}`, adicionar o rodapé:
```
{{3}}

ESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!
```

## Execução

Um único UPDATE nos 2 registros da tabela `whatsapp_meta_templates`.

## Arquivo afetado

Nenhum arquivo de código — apenas dados no banco.

