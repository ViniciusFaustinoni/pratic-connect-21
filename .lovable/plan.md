## Diagnóstico confirmado

**Causa bloqueante real:** o fluxo para em **cadastro do veículo no SGA**, antes da etapa de mídia.

### O que o código faz hoje
1. **Autentica no Hinova**  
   - `supabase/functions/sga-hinova-sync/index.ts:847-866`
2. **Busca/cadastra associado**  
   - busca: `supabase/functions/sga-hinova-sync/index.ts:868-905`  
   - cadastro: `supabase/functions/sga-hinova-sync/index.ts:907-1000`
3. **Busca/cadastra veículo**  
   - busca/reuso: `supabase/functions/sga-hinova-sync/index.ts:1003-1112`  
   - cadastro: `supabase/functions/sga-hinova-sync/index.ts:1113-1451`
4. **Só depois disso envia fotos/docs**  
   - início da etapa de mídia: `supabase/functions/sga-hinova-sync/index.ts:1520-1707`

### Onde o caso do MARCOS quebra
O abort explícito está aqui:
- `supabase/functions/sga-hinova-sync/index.ts:1420-1451`

Se `cadastrar_veiculo` falha:
- seta `status_sga = 'erro_sincronizacao'`
- grava fila em `sga_sync_queue` com `etapa_parou='veiculo'`
- faz `return`
- **não entra** na etapa 7 (`FOTOS`)

Isso explica por que **nem veículo nem fotos/docs foram enviados**.

### Evidência do banco para TOG2A62
Consulta cruzada mostrou:
- `sga_sync_queue.status = 'pendente'`
- `sga_sync_queue.etapa_parou = 'veiculo'`
- `sga_sync_queue.codigo_associado_hinova = 30523`
- `sga_sync_queue.codigo_veiculo_hinova = null`
- `veiculos.status_sga = 'erro_sincronizacao'`

Ou seja: **o associado foi resolvido no Hinova, mas o veículo nunca foi criado**, então não existe `codigo_veiculo_hinova` para anexar mídia.

### Evidência dos logs do caso
Os logs do veículo mostram exatamente esta sequência:
- `resolver_grupo_sga` = warning, não bloqueante  
  - `supabase/functions/sga-hinova-sync/index.ts:778-807`
- `autenticar` = sucesso  
- `buscar_associado` = sucesso  
- `cadastrar_veiculo` = falha nas 3 variantes FIPE  
- `listar_modelos_hinova` = sem retorno útil  
- `cadastrar_veiculo` = erro final  

As 3 variantes FIPE vêm daqui:
- `supabase/functions/_shared/hinova-payloads.ts:209-230`
- loop de tentativa: `supabase/functions/sga-hinova-sync/index.ts:1321-1353`

O fallback por catálogo Hinova vem daqui:
- `supabase/functions/sga-hinova-sync/index.ts:1356-1417`
- cliente de catálogo: `supabase/functions/_shared/hinova-client.ts:1829-1892`
- heurística de escolha: `supabase/functions/_shared/hinova-client.ts:1905-1935`

No caso TOG2A62, o log confirma:
- FIPE tentadas: `001589-0`, `0015890`, `001589`
- catálogo Hinova: `Nenhum modelo encontrado no catálogo Hinova (endpoint=/buscar/modelo/Fiat, status=406)`

**Fato objetivo:** o código não conseguiu resolver nem `codigo_fipe` aceito pelo tenant, nem `codigo_modelo` via fallback. Sem isso, o veículo não é criado.

### Sobre fotos/docs: existe envio separado?
**Não existe** no codebase um endpoint separado de “documentos” para o SGA.

O que existe é:
- coleta de `documentos`, `contratos_documentos`, `avatar_url` e `vistoria_fotos`:  
  `supabase/functions/sga-hinova-sync/index.ts:1523-1606`
- transformação de tudo em payload de foto:  
  `supabase/functions/_shared/hinova-payloads.ts:354-410`
- envio único para `POST /veiculo/foto/cadastrar`:  
  `supabase/functions/_shared/hinova-client.ts:1646-1667`

Então, no código atual, **docs e fotos dependem 100% de `codigoVeiculoHinova` existir**.

### Também confirmei que havia mídia local para enviar
Para TOG2A62 existem artefatos locais:
- `documentos`: **1**
- `contratos_documentos`: **4**
- `vistorias`: **1**
- `vistoria_fotos`: **31**

Ou seja: **não faltou mídia local**; faltou o veículo remoto para vincular a mídia.

### O warning do plano sem grupo SGA é a causa?
**Não.**
Esse warning é explicitamente não-bloqueante:
- `supabase/functions/sga-hinova-sync/index.ts:796-807`

O próprio comentário diz que o fluxo segue sem `codigo_grupo_produto`.

### O 401 em uma tentativa antiga é a causa?
**Não para este erro final.**
Houve uma tentativa com `buscar_associado` 401, mas nas tentativas seguintes:
- `autenticar` deu sucesso
- `buscar_associado` deu sucesso
- a falha voltou a acontecer em `cadastrar_veiculo`

Então a causa recorrente deste caso é o bloco de resolução/cadastro do veículo, não autenticação.

---

## Plano de correção

### 1) Corrigir a resolução de modelo no fallback Hinova
Ajustar o fallback de catálogo para não morrer silenciosamente quando o tenant devolve 406/estrutura vazia nos endpoints atuais.

**Arquivos alvo:**
- `supabase/functions/_shared/hinova-client.ts`
- `supabase/functions/sga-hinova-sync/index.ts`

**Mudanças:**
- registrar o resultado de **cada endpoint candidato** em `listarModelosHinova`, não só o último
- normalizar melhor `marca/modelo` antes da busca no catálogo
- enriquecer o fallback com tentativa mais orientada ao nome base do modelo quando o nome comercial vier composto
- devolver debug estruturado suficiente para comprovar por que nenhum candidato serviu

### 2) Melhorar a observabilidade do erro recorrente
Hoje o log final guarda só o último `endpoint/status` do fallback de catálogo.

**Mudanças:**
- incluir no log de `listar_modelos_hinova` o histórico de candidatos tentados
- logar se `escolherMelhorModeloHinova` recebeu lista vazia ou rejeitou candidatos por score
- logar explicitamente quando não existe `codigo_modelo_hinova` persistido e o fast-path foi pulado

### 3) Reprocessar o caso TOG2A62 após a correção
Depois do ajuste:
- reexecutar `sga-hinova-sync` para TOG2A62
- validar criação de `codigo_veiculo_hinova`
- validar entrada na etapa `FOTOS`
- conferir envio dos 1 + 4 + 31 artefatos elegíveis

### 4) Validar se o problema afeta outros casos iguais
Usar o mesmo padrão para localizar outros veículos presos em:
- `sga_sync_queue.etapa_parou = 'veiculo'`
- `erro_ultimo` contendo `MODELO enviado não foi encontrado`

---

## Detalhes técnicos

```text
Fluxo atual
associado OK -> veículo falha -> return -> mídia não roda

Ponto exato do bloqueio
sga-hinova-sync/index.ts:1420-1451

Ponto exato da mídia
sga-hinova-sync/index.ts:1520-1707
```

Se você aprovar, eu implemento a correção e deixo o log do próximo caso autoexplicativo.