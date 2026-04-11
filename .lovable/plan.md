

## Plano: Botão "Gerar Link" em vez de bloquear a página

### Problema
A abordagem anterior de manter a tela em loading até o link chegar faz com que a página não abra. O sistema fica preso no spinner de "Preparando assinatura digital...".

### Nova abordagem
Mostrar sempre a tela de `aguardando_assinatura` (com informações do contrato, instruções, etc.), mas:
- **Sem link**: mostrar um botão "Gerar Link" no lugar dos botões "Assinar Contrato Agora" e "Copiar Link"
- **Com link**: mostrar os botões normais de assinatura

### Alteração em `EtapaAssinaturaContrato.tsx`

**1. Mudar estado `enviando_autentique` para ir direto a `aguardando_assinatura`**
- Na função `enviarParaAutentique` (linha 258), quando o link não é retornado imediatamente, setar `setEtapaInterna('aguardando_assinatura')` em vez de ficar em `enviando_autentique`
- O polling de 3s já existente (linha 342) continuará buscando o link em background

**2. Ajustar o render do estado `aguardando_assinatura` (linhas 729-750)**
- Envolver os botões "Assinar Contrato Agora" e "Copiar Link" em condição `{linkAssinatura ? (...botões...) : (...botão Gerar Link...)}`
- O botão "Gerar Link" chamará a mesma lógica de polling manual (buscar `autentique_url` do contrato) e, se não encontrar, invocar `autentique-create` novamente
- Mostrar spinner no botão enquanto busca

**3. Remover o bloco `enviando_autentique` do render de loading (linha 557)**
- Manter apenas `verificando` e `gerando_contrato` como estados de loading (spinner fullscreen)
- `enviando_autentique` não precisa mais de render próprio pois transiciona direto para `aguardando_assinatura`

### Resultado
- A página sempre abre mostrando as instruções e informações do contrato
- Se o link não estiver pronto, aparece o botão "Gerar Link" para o usuário clicar
- Quando o link chega (via polling automático ou clique manual), os botões de assinatura aparecem automaticamente

