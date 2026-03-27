

# Alterar Texto de Aviso "IMPORTANTE" na Proposta de Filiação

## Problema

O texto abaixo da seção "ASSOCIADO INDICADOR" no template da Proposta de Filiação contém um aviso "IMPORTANTE" desatualizado. O conteúdo precisa ser substituído pelo novo texto fornecido.

## Localização

O texto está na tabela `documento_templates`, registro com `id = 'eb09759f-cfbc-4ee8-8f1f-f1cc520e7279'` (nome: "Proposta de Filiação"), no campo `conteudo`. É um template HTML editável pelo TipTap.

## Alteração

Criar uma migração SQL que faz `UPDATE` no campo `conteudo` desse template, substituindo o parágrafo atual após `<p><strong>IMPORTANTE</strong></p>` pelo novo texto:

**Texto atual (a remover):**
> No caso de roubo ou furto, o associado deve comunicar imediatamente a PRATICCAR através do 0800 980 0001 o evento ocorrido; Caso o veículo protegido pela PRATICCAR seja conduzido por pessoa sem habilitação, o mesmo não estará coberto pelo programa de Benefícios Mútuos da PRATICCAR; O associado fica ciente que o rastreador instalado no veículo ficará sob sua responsabilidade em caráter de comodato e a não devolução do rastreador a PRATICCAR ocasionará ao associado o pagamento de uma multa estipulada em R$400,00; Os benefícios do PSM para veículo do associado cadastrado têm início às 00:00h no primeiro dia útil subsequente a data de aceitação da vistoria e da instalação do equipamento de rastreamento, quando obrigatório, sendo o início no ato que ocorrer por último.

**Novo texto:**
> No caso de roubo, furto, incêndio, colisão e alagamento, o associado deve comunicar imediatamente a PRATICCAR através do 0800 980 0001 o evento ocorrido sob pena de negativa de cobertura; Caso o veículo protegido pela PRATICCAR infrinja as normas do Código de Trânsito Brasileiro (CTB), tais como: conduzir na contramão de direção; avançar o sinal semafórico ou o de parada obrigatória; dirigir sob efeito de álcool ou recusar-se a realizar o teste do etilômetro; exceder o limite de velocidade; manusear/utilizar o telefone celular ou pegar objetos no interior do veículo durante a condução; bem como cometer qualquer outra infração classificada como grave ou gravíssima, os benefícios previstos no Programa de Socorro Mútuo da PRATICCAR serão automaticamente negados; O associado fica ciente que o rastreador instalado no veículo ficará sob sua responsabilidade em caráter de comodato e a não devolução do rastreador à PRATICCAR ocasionará ao associado o pagamento de uma multa estipulada em R$400,00; Os benefícios de roubo, furto, colisão, alagamento e incêndio do PSM têm início no primeiro dia útil subsequente à data de aceitação da vistoria e da instalação do equipamento de rastreamento, quando obrigatório, sendo o início no ato que ocorrer por último. Os demais benefícios só estarão disponíveis após 48 horas (quarenta e oito horas) úteis após o prazo supracitado; O ASSOCIADO declara estar ciente de que a PRATICCAR é uma associação de benefícios mútuos, regida por seu Estatuto e em conformidade com as normas legais aplicáveis. Declara, ainda, que recebeu cópia do Regulamento Associativo e do Regulamento de Assistência 24 Horas, tendo lido, compreendido e possuindo pleno conhecimento de todas as normas neles contidas, as quais aceita e com as quais concorda integralmente, estando plenamente ciente de todo o seu conteúdo.

Tambem será removido o parágrafo em negrito logo abaixo (a antiga declaração em CAPS LOCK que agora está integrada no novo texto acima).

## Implementacao

Uma migração SQL usando `REPLACE()` no campo `conteudo` para trocar o texto antigo pelo novo no registro do template.

## Arquivos

| Arquivo | Acao |
|---|---|
| Nova migracao SQL | UPDATE no `documento_templates` substituindo o texto do aviso IMPORTANTE |

