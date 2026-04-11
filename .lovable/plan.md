

## Plano: Correção definitiva dos templates e posicionamento de assinatura Autentique

### Sobre a Autentique e posicionamento de assinaturas

A Autentique **usa coordenadas percentuais (x%, y%, página)** para posicionar assinaturas. Ela NÃO tem detecção automática de "campos de assinatura" no HTML. O que temos hoje (INITIALS em cada página intermediária + SIGNATURE na última página) é a arquitetura correta. O problema é a estimativa incorreta do número de páginas e resquícios de blocos manuais.

### Problemas identificados no PDF assinado (30 páginas)

1. **Estimativa de páginas errada**: O documento tem 29 páginas de conteúdo + 1 de auditoria Autentique = 30. Mas a heurística de `~3000 chars = 1 página` subestimou, e a SIGNATURE caiu na página 20, sobrepondo o texto do regulamento.

2. **Blocos manuais de assinatura remanescentes**:
   - Páginas 3 e 5: Linhas como `RIO DE JANEIRO, 11 de abril de 2026.` seguida de `**MARCUS VINICIUS FAUSTINONI DE FREITAS - CPF: 124.936.497-37**` — são blocos manuais de assinatura que o `sanitizeSignatureBlocks` não capturou porque o nome real (não variável `{{associado.nome}}`) foi substituído antes da sanitização.
   - Página 6: Cabeçalho "### ASSINATURA" no Termo de Rastreador (vem do template gerado programaticamente).

3. **Posição Y da SIGNATURE (85%)**: Em uma página A4 com margens de 20mm, y=85% coloca a assinatura sobre o conteúdo textual. Para a última página, que geralmente tem pouco conteúdo na parte inferior, 90-92% seria mais adequado.

### Alterações propostas

**1. `supabase/functions/_shared/autentique-positions.ts`** — Melhorar heurística de estimativa
- Reduzir de 3000 para **2000 chars/página** (mais conservador, garante nunca subestimar)
- Adicionar margem de **+2 páginas** em vez de +1
- Resultado: um documento que antes estimava 20 páginas passará a estimar ~30+, garantindo que a SIGNATURE fique na última página real (páginas excedentes são ignoradas pela Autentique)

**2. `supabase/functions/_shared/template-utils.ts`** — Fortalecer sanitização
- Adicionar regras para capturar blocos com nome real + CPF formatado (não variável):
  - `<p><strong>NOME COMPLETO - CPF: 123.456.789-00</strong></p>` (padrão bold nome-CPF)
  - Parágrafos com cidade + data por extenso no padrão `CIDADE, dd de mês de yyyy.`
- Adicionar captura de `### ASSINATURA` (heading h3 markdown-convertido)

**3. `supabase/functions/_shared/termo-afiliacao-template.ts`** — Remover heading "ASSINATURA" do rastreador
- Remover o trecho que gera o bloco com heading "ASSINATURA" e local/data dentro da seção do rastreador (ainda resta no template, como visto na página 6)

**4. Fluxos de criação** — Garantir ordem sanitização → estimativa
- Nos edge functions `autentique-create` e `autentique-create-by-token`: chamar `sanitizeSignatureBlocks()` no HTML final **antes** de chamar `estimarPaginasHTML()`, para que os blocos removidos não inflem a contagem de páginas

### Resultado esperado
- A SIGNATURE será posicionada corretamente na última página real (~página 29), não na 20
- Todas as linhas manuais de "Local/Data" e "Nome - CPF" serão removidas do corpo do documento
- O heading "ASSINATURA" no Termo de Rastreador desaparecerá
- A rubrica (INITIALS) continuará funcionando corretamente em todas as páginas intermediárias (como já está)

