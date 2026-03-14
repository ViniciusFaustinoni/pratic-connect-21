
Diagnóstico confirmado (investigação profunda)

1) A variável NÃO está sendo inserida pelo motor de template nesta etapa.
2) A origem real está no arquivo de logo usado no cabeçalho dos documentos:
   - `public/images/logo-praticcar.jpg`
   - O conteúdo da imagem é exatamente: `Serviços:` + `{{plano.descricao}}`.
3) Esse arquivo é injetado no HTML dos documentos Autentique nestes pontos:
   - `supabase/functions/_shared/template-utils.ts` (geração padrão de contrato)
   - `supabase/functions/autentique-evento-create/index.ts`
   - `supabase/functions/autentique-os-saida-create/index.ts`
   - `supabase/functions/autentique-cancelamento-create/index.ts`
4) Por isso o texto aparece “acima” do documento: ele vem como imagem no bloco de logo, não como variável de conteúdo.

Plano de correção definitiva

1) Corrigir a fonte visual
- Substituir o logo inválido por um logo correto em todos os geradores acima (usar um asset válido já existente, ex.: `public/pratic-logo.png` ou `public/logos/logo-full-light.png`).
- Remover dependência do arquivo problemático `public/images/logo-praticcar.jpg` (ou sobrescrevê-lo com o logo correto para compatibilidade retroativa).

2) Blindagem extra de conteúdo
- Manter a limpeza atual de `Serviços: {{plano.descricao}}`.
- Adicionar limpeza defensiva para variantes legadas (ex.: `((plano.descricao))` e linha isolada de `plano.descricao`) no pipeline de geração, para não reaparecer caso alguém cole conteúdo antigo no template.

3) Tratar documentos já gerados
- Documentos Autentique já criados não se atualizam automaticamente.
- Para contratos afetados, executar regeneração (limpar/recriar vínculo Autentique do contrato e gerar novo link) para que o novo HTML use o logo corrigido.

Detalhes técnicos (objetivo por arquivo)

- `_shared/template-utils.ts`: trocar URL hardcoded do logo no `generateHeader`.
- `autentique-evento-create`, `autentique-os-saida-create`, `autentique-cancelamento-create`: trocar a mesma URL hardcoded.
- Utilitário de limpeza: consolidar regex defensivas em função compartilhada e reutilizar nos fluxos de criação.

Resultado esperado

- O bloco “Serviços: {{plano.descricao}}” desaparece de forma definitiva no topo.
- Novos documentos saem limpos.
- Contratos antigos afetados ficam corretos após regeneração do documento.
