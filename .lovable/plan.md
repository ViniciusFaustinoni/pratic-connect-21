# Endereço editável no agendamento de Retirada de Rastreador

## Problema

No modal **Solicitar Retirada de Rastreador** (Monitoramento), quando o atendimento é **Volante (domicílio)**, o sistema hoje copia silenciosamente o endereço do cadastro do associado para `servicos` e segue. O Monitoramento não tem como **confirmar** que esse endereço é o correto, nem como **informar um endereço diferente** (caso o associado avise por WhatsApp/telefone que o veículo está em outro lugar).

Quando o local é **Base (Caxias)**, endereço é o da sede — não muda nada.

## Escopo

Apenas UI + payload do hook. Sem migration: as colunas `logradouro/numero/bairro/cidade/uf/cep/latitude/longitude` já existem em `servicos` e o hook `useAbrirRetirada` já as grava.

Arquivos:
- `src/components/monitoramento/retirada/AbrirRetiradaModal.tsx`
- `src/hooks/useRetiradaRastreador.ts` (estender `AbrirRetiradaParams` com campos de endereço estruturado e usá-los no insert quando vierem)

## Comportamento

Quando `localTipo === 'volante'`:

1. Logo abaixo do radio "Volante (domicílio)", aparece um **bloco "Endereço do atendimento"** já pré-preenchido com o endereço do associado (CEP, logradouro, número, bairro, cidade/UF).
2. Dois modos, controlados por radio dentro do bloco:
   - **Usar endereço cadastrado** (padrão) — mostra o endereço em modo leitura, com badge "do cadastro do associado".
   - **Informar outro endereço** — desbloqueia inputs editáveis (CEP com busca ViaCEP igual ao restante do app, logradouro, número, complemento opcional, bairro, cidade, UF). Validação obrigatória dos campos exceto complemento.
3. O endereço escolhido (cadastro ou novo) é gravado nas colunas de `servicos` no insert.
4. Se "Informar outro endereço": o `observacoes` ganha automaticamente uma linha prefixada `[Endereço alternativo informado pelo Monitoramento]` antes do texto livre, pra ficar rastreável na timeline do serviço.

Quando `localTipo === 'base'`: nenhum bloco de endereço aparece (comportamento atual).

## Detalhes técnicos

`AbrirRetiradaModal.tsx`:
- Novos estados: `enderecoModo: 'cadastro' | 'novo'`, e os campos `cep/logradouro/numero/complemento/bairro/cidade/uf`.
- Reaproveitar o componente/hook de busca de CEP já existente no projeto (procurar `useCep`/`buscarCep`/ViaCEP — se houver, reusar; senão, fetch direto a `viacep.com.br`).
- Reset no `useEffect` de fechamento e quando `localTipo` muda para `base`.
- `isValid` inclui validação do endereço quando `volante` + `modo === 'novo'`.

`useRetiradaRastreador.ts`:
- Adicionar em `AbrirRetiradaParams` o objeto opcional `enderecoCustom?: { logradouro; numero; complemento?; bairro; cidade; uf; cep; latitude?; longitude? }`.
- No bloco "4. Determinar endereço": se `enderecoCustom` veio, usar ele; senão, manter o fallback atual (cadastro do associado).
- A chamada de WhatsApp (`notificar-retirada-whatsapp`) já recebe `local: params.localEndereco` — passar a string formatada do endereço escolhido nesse campo, pra o associado ver no aviso.

## Fora do escopo

- Geocoding automático do endereço novo (lat/long ficam null se não vierem do ViaCEP — não bloqueia agendamento).
- Editar endereço **depois** que o serviço já foi agendado (caso pedido depois, abre nova história).
- Tela de retirada do instalador (`ExecutarRetirada`) — ela já lê `logradouro/numero/...` direto de `servicos`, então passa a mostrar o endereço correto sem alteração.

## Validação manual

1. Abrir retirada de um rastreador qualquer com Volante → confirmar que endereço do associado aparece pré-preenchido em modo leitura.
2. Trocar para "Informar outro endereço", digitar CEP válido → ViaCEP preenche, ajustar número, agendar.
3. Conferir em `servicos` que o endereço novo foi gravado nas colunas e que `observacoes` recebeu o prefixo.
4. Trocar para Base → bloco some.
