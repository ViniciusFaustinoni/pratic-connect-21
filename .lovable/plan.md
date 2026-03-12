

# Revisão de Variáveis dos Templates Meta WhatsApp

## Problemas Encontrados

### 1. `tecnico_a_caminho_1` - Variável fantasma no exemplo
- **Corpo** tem 6 variáveis: `{{1}}` a `{{6}}`
- **`variaveis_exemplo`** tem **7 entradas** (inclui chave `"7"` com texto "Você pode entrar em contato com o técnico...")
- A variável `"7"` no exemplo **não existe no corpo** do template. Se a Meta sincronizar e comparar, pode causar rejeição ou erro no disparo de teste.
- **Correção**: Remover a chave `"7"` de `variaveis_exemplo`.

### 2. `comunicacao_sinistro` - Campo `botoes` NULL mas pode ter botão na Meta
- O corpo contém `{{8}}` como URL inline no texto (`🔗 {{8}}`)
- **`botoes` está NULL** no banco de dados
- Se o template foi criado na Meta **com um botão URL dinâmico** (ao invés de URL inline no corpo), o banco está dessincronizado. Quando o disparo de teste envia 8 params no body e a Meta espera 7 body + 1 button, ocorre o erro `132000` (param count mismatch).
- O auto-retry na edge function resolve isso, mas é ineficiente (2 requests para cada envio).
- **Correção**: Sincronizar (`Sincronizar`) para atualizar a estrutura de botões, ou corrigir manualmente o campo `botoes` no banco.

### 3. `reboque_veiculo_carregado` - URL de exemplo genérica
- `variaveis_exemplo["4"]` = `"https://www.seusite.com.br/praticcar"` (placeholder genérico)
- Deveria ser algo como `"https://pratic-connect-21.lovable.app/acompanhar/reboque/abc123"` para consistência.
- **Impacto**: Baixo, apenas cosmético no disparo de teste.

### 4. Templates sem `botoes` mas com URLs no corpo
Os seguintes templates têm URLs como variáveis de texto no corpo (sem botão URL):
- `comunicacao_sinistro` ({{8}})
- `despacho_reboque_novo` ({{5}})
- `reboque_a_caminho` ({{4}})
- `reboque_chegou_local` ({{2}})
- `reboque_veiculo_carregado` ({{4}})

Isso funciona, mas **URLs em variáveis de corpo não geram preview clicável** no WhatsApp. Se foram submetidos à Meta com botão URL, o campo `botoes` deveria refletir isso.

## Plano de Correção

### Correção no banco de dados (SQL migration)
1. Remover a variável extra `"7"` de `tecnico_a_caminho_1`
2. Atualizar a URL de exemplo de `reboque_veiculo_carregado`

### Recomendação operacional
- Clicar em **Sincronizar** na interface para atualizar os campos `botoes` de todos os templates com os dados reais da Meta. Isso garantirá que o auto-split funcione corretamente no primeiro request.

