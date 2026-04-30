## Objetivo
Tornar a leitura de CPF em PDFs de CNH efetiva e previsível, evitando “chutes” do modelo quando o CPF está visível no documento.

## Diagnóstico atual
- O print anexado mostra um CPF claramente legível: `124.936.497-37`.
- Os logs atuais da edge function `document-ocr` mostram que o OCR extraiu `074.905.497-37`, detectou que era inválido, tentou retry e ainda assim falhou.
- O problema principal não parece ser “falta de CPF no documento”, e sim falha de estratégia de leitura.
- Hoje o fluxo mistura:
  - tentativa de texto nativo do PDF (`unpdf`),
  - envio do PDF para a IA,
  - retry focado em CPF,
  - correção por permutação.
- Isso ainda deixa espaço para erro porque a leitura continua muito global do documento inteiro e não suficientemente ancorada no campo correto.
- Além disso, a tabela `ocr_execution_logs` está vazia no momento, então a trilha detalhada de auditoria ainda não está confiável o suficiente para diagnosticar cada execução em produção.

## Direção recomendada
Não escolher “texto ou imagem”. O caminho correto é um fluxo híbrido, com prioridade determinística:

1. Texto nativo do PDF, quando existir.
2. Imagem renderizada da(s) página(s) do PDF.
3. OCR focado no recorte do campo CPF.
4. Validação contextual + checksum antes de aceitar o valor.

Ou seja: para PDF bom, usar texto. Para PDF escaneado/sem texto, usar imagem. Para CPF crítico, sempre fazer leitura localizada do campo.

## Plano concreto de implementação

### Etapa 1 — Corrigir a observabilidade primeiro
Antes de mexer no OCR em si, garantir que cada execução apareça de fato nos logs OCR.

Implementar:
- validação do ponto de persistência em `ocr_execution_logs`;
- log explícito de qual fonte foi usada para o CPF:
  - `native_text`
  - `page_image`
  - `cpf_crop`
  - `retry_model`
- log de candidatos encontrados e motivo da escolha/rejeição;
- log se o PDF tinha ou não camada de texto;
- log do trecho textual ao redor do rótulo `CPF`/`4d CPF` quando existir.

Resultado esperado:
- toda leitura nova aparece na aba OCR;
- fica claro se a falha veio de ausência de texto, erro de renderização, leitura visual ruim ou heurística incorreta.

### Etapa 2 — Mudar a estratégia de PDFs para fluxo híbrido
Parar de tratar PDF apenas como “arquivo anexado para o modelo enxergar” e passar a processá-lo em duas frentes:

#### 2.1 Texto nativo do PDF
Para CNH em PDF digital:
- extrair o texto nativo;
- procurar CPF por contexto, não pelo primeiro número válido do documento;
- usar janela textual ancorada em rótulos como:
  - `CPF`
  - `CPF/MF`
  - `4d CPF`
- aceitar o CPF apenas se:
  - estiver próximo do rótulo correto;
  - passar checksum;
  - não colidir com `registro`, `RG`, `RENACH`, numeração lateral ou outras zonas numéricas.

#### 2.2 Renderização do PDF em imagem
Quando o PDF não tiver texto nativo útil, ou quando o texto nativo não trouxer CPF confiável:
- renderizar as páginas do PDF em PNG de alta resolução;
- processar pelo menos página 1 e página 2 em CNH-e;
- enviar a imagem renderizada, não o PDF bruto, para a etapa visual.

Resultado esperado:
- PDFs digitais passam a acertar via texto nativo;
- PDFs escaneados deixam de depender de interpretação inconsistente do PDF bruto.

### Etapa 3 — OCR focado no campo CPF da CNH
Adicionar uma etapa específica para CNH:
- localizar a região do campo `4d CPF` com base no layout da CNH;
- gerar um crop só do campo CPF;
- rodar uma leitura dedicada apenas nesse crop;
- comparar o resultado com a leitura global e preferir a leitura local se ela passar checksum.

Regras:
- o valor do crop só entra se passar checksum;
- se global e crop divergirem, vence o que estiver melhor ancorado no campo correto;
- se ambos falharem, retornar `ilegivel` com motivo, e não um número inventado.

### Etapa 4 — Endurecer as regras de aceitação do CPF
Hoje o pipeline ainda tenta “resgatar” demais o CPF. Isso ajuda em alguns casos, mas também cria falso positivo.

Ajustar regras:
- nunca aceitar CPF só porque parece visualmente plausível;
- nunca aceitar CPF fora de contexto do rótulo correto;
- permutação de dígitos só pode rodar quando houver evidência forte de que a leitura veio do campo CPF correto;
- se houver dúvida real, marcar como `ilegivel` e enviar para revisão.

Resultado esperado:
- reduz erro silencioso;
- prioriza precisão sobre preenchimento forçado.

### Etapa 5 — Melhorar o prompt e separar responsabilidades
Hoje o modelo está sendo instruído a ler o documento inteiro e depois fazer retry do CPF. Isso é útil, mas insuficiente.

Separar em duas responsabilidades:
- extração geral do documento;
- extração crítica e dedicada do CPF da CNH.

Ajustes no prompt:
- instruir o modelo a ignorar números fora do bloco `CPF`;
- mencionar explicitamente que `registro`, `RG`, numeração lateral e outros identificadores não podem ser usados como CPF;
- quando o documento for PDF com texto nativo, declarar que o texto ancorado no rótulo é a fonte principal;
- quando houver crop do CPF, instruir o modelo a ler somente aquele campo.

### Etapa 6 — Validar com conjunto real de documentos
Montar uma bateria de validação com exemplos reais:
- CNH PDF digital com texto nativo;
- CNH PDF escaneada;
- screenshot/export da CNH;
- CNH com compressão forte;
- CNH com CPF muito nítido e outros números próximos.

Critérios de aceite:
- o documento do seu exemplo precisa sair correto;
- o OCR não pode trocar CPF por registro/RG;
- toda execução precisa aparecer na auditoria OCR;
- quando não tiver confiança, precisa retornar revisão/ilegível com motivo claro.

## Decisão técnica recomendada
A recomendação final é:
- usar texto nativo do PDF como primeira fonte quando existir;
- renderizar o PDF para imagem quando o texto nativo não resolver;
- fazer OCR dedicado do recorte do campo CPF na CNH;
- aceitar apenas CPF validado por contexto + checksum.

Em resumo: não é “ou texto ou imagem”. É `texto primeiro, imagem como fallback, crop do CPF como validação crítica`.

## Detalhes técnicos
- Arquivo principal afetado: `supabase/functions/document-ocr/index.ts`
- Ajustes esperados também no fluxo que envia PDFs para OCR, para suportar renderização por página/imagem quando necessário.
- Pode ser necessário complementar a auditoria OCR para registrar `source_used`, candidatos e contexto do CPF.
- A UI de logs OCR deve continuar como está, mas com mais dados úteis por execução.

## Resultado esperado após implementação
- PDFs como o do exemplo passam a retornar o CPF correto.
- O OCR deixa de “adivinhar” CPF em CNH quando o número correto está visível.
- Fica possível entender exatamente por que uma leitura falhou.
- A equipe passa a ter um fluxo confiável para tratar PDFs digitais e PDFs escaneados.

## Ordem de execução
1. Corrigir persistência/auditoria dos logs OCR.
2. Implementar extração contextual via texto nativo do PDF.
3. Implementar renderização de PDF em imagem para fallback.
4. Implementar crop específico do campo CPF da CNH.
5. Endurecer regras de aceitação/permutação.
6. Validar com casos reais e ajustar limiares.

Se você aprovar, o próximo passo é executar exatamente esse plano, começando por consertar a auditoria OCR e depois refatorar a leitura de PDF para esse fluxo híbrido.