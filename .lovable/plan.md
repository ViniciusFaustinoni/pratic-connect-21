
Objetivo: corrigir a causa real da alucinação observada nos logs, para que a IA use os dados corretos da placa/FIPE.

Diagnóstico confirmado pelos últimos logs:
- `whatsapp-webhook` recebeu `Ltb4j74` e encaminhou corretamente para o agente.
- `agente-consultor-ia` chamou a tool `consultar_placa`.
- `plate-lookup` retornou com sucesso os dados corretos:
  - Marca: `Toyota`
  - Modelo: `corolla Xei Flex`
  - Ano: `2013/2014`
  - FIPE: `72122`
- Portanto, o problema não está na consulta da FIPE API.
- O bug está no mapeamento dentro de `supabase/functions/agente-consultor-ia/index.ts`: a função `executarConsultaPlaca` espera campos no topo do JSON (`data.marca`, `data.modelo`, `data.valor_fipe`), mas a `plate-lookup` devolve os dados em:
  - `data.vehicleData`
  - `data.fipeData`

Impacto do bug:
- O tool result enviado ao modelo fica sem `marca`, `modelo`, `ano` e `valor_fipe` corretos.
- Com o resultado incompleto, o modelo “preenche” sozinho e alucina veículo/FIPE.

Implementação proposta:
1. Corrigir `executarConsultaPlaca` para ler a resposta real da `plate-lookup`
   - `marca` ← `data.vehicleData?.marca`
   - `modelo` ← `data.vehicleData?.modelo`
   - `ano` ← extrair ano-modelo numérico de `data.vehicleData?.ano`
   - `combustivel` ← `data.vehicleData?.combustivel`
   - `valor_fipe` ← `data.fipeData?.valor`
   - `cor` ← `data.vehicleData?.cor`
   - opcionalmente incluir `placa_consultada`, `marca_modelo`, `tipo_veiculo`

2. Normalizar o retorno da tool para o modelo
   - Entregar um objeto simples e explícito, por exemplo:
     ```json
     {
       "success": true,
       "placa": "LTB4J74",
       "marca": "Toyota",
       "modelo": "Corolla XEi Flex",
       "ano_modelo": 2014,
       "ano_texto": "2013/2014",
       "combustivel": "Alcool / Gasolina",
       "valor_fipe": 72122,
       "cor": "Azul"
     }
     ```
   - Isso reduz ambiguidade e diminui muito a chance de alucinação.

3. Reforçar a resposta da tool no prompt contextual
   - Manter o aviso “DADOS OFICIAIS”.
   - Complementar dizendo que, se algum campo vier ausente, a IA deve dizer que precisa confirmar manualmente, e não completar por conta própria.

4. Adicionar logs defensivos no `agente-consultor-ia`
   - Logar o payload bruto resumido retornado por `plate-lookup`
   - Logar o objeto normalizado final enviado ao modelo
   - Isso permitirá validar rapidamente se o problema foi resolvido em produção.

5. Validar o cenário com a mesma placa do incidente
   - Reexecutar o fluxo com `LTB4J74`
   - Confirmar que a resposta menciona Toyota Corolla/FIPE correta e não outro veículo

Arquivos a ajustar:
- `supabase/functions/agente-consultor-ia/index.ts`

Detalhe técnico importante:
- Hoje a `plate-lookup` retorna neste formato:
  ```text
  {
    success: true,
    extractedPlate,
    vehicleData: { marca, modelo, ano, combustivel, cor, ... },
    fipeData: { codigo, valor, mesReferencia }
  }
  ```
- Mas `executarConsultaPlaca` está lendo como se fosse:
  ```text
  { marca, modelo, ano, combustivel, valor_fipe, cor }
  ```
- Essa incompatibilidade é a causa direta do erro visto no print e nos logs.

Critério de sucesso:
- Ao informar uma placa válida, a IA deve sempre responder usando exatamente os dados retornados por `plate-lookup`.
- Se a consulta falhar, a IA deve pedir os dados manualmente.
- A IA não deve mais citar veículo ou FIPE diferentes dos retornados pela API.
