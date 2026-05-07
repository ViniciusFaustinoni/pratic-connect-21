## Objetivo

Substituir o HTML do termo de cancelamento enviado na **troca de titularidade** pelo layout idêntico ao PDF oficial (`TERMO_DE_CANCELAMENTO_PRATICCAR.pdf`).

## Arquivo

`supabase/functions/enviar-termo-cancelamento-troca/index.ts` (linhas 51–78).

## Conteúdo do termo (texto fixo, igual ao PDF)

1. Logo Praticcar centralizada no topo.
2. Título: **TERMO DE CANCELAMENTO**.
3. Parágrafo de qualificação: "Eu, **{nome}**, portador da identidade de n° **{rg}** inscrito no CPF sob o n° **{cpf}**, residente ao endereço **{endereco_completo}**."
4. "Solicito o cancelamento de todos os benefícios oferecidos pela Praticcar, inclusive o benefício da proteção veicular do veículo **{marca modelo ano}**, placa **{placa}**;"
5. Cláusula do rastreador (texto literal do PDF, com R$ 400,00 / fiel depositário / regulamento).
6. Caixa "motivo:" preenchida automaticamente com `Troca de titularidade para {novo_titular.nome} (CPF {novo_titular.cpf}).`
7. "Data: dd/mm/aaaa" e linha de "ASSINATURA DO ASSOCIADO".
8. Rodapé: site, telefone, redes sociais e endereço (Av. das Américas, 19005, Recreio – RJ).

## Mudanças no código

1. Buscar campos extras do associado antigo: `rg, logradouro, numero, complemento, bairro, cidade, uf, cep` (já existem na tabela `associados`).
2. Montar `endereco_completo` concatenando esses campos (ignora vazios).
3. Trocar a string `html` (linhas 67–78) pelo template novo com CSS A4, fontes Arial, caixa do motivo, footer e logo via `https://app.praticcar.org/logos/logo-full-light.png`.
4. Manter todo o restante do fluxo intacto: criação no Autentique, `PF_FACIAL`, salvamento de `termo_cancelamento_autentique_id/url/enviado_em`, disparo do WhatsApp.

## Validação

- Re-disparar o termo da solicitação `b4c8b25d…` (KREITON ← MARCOS, placa KOU6D37) e conferir o preview no Autentique antes de assinar.
- Garantir que campos faltantes apareçam como `___` (não como `null/undefined`).