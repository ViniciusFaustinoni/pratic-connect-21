

## Bug

`ExecutarVistoriaCompleta.tsx` mostra "4/31 fotos" para uma **moto** (deveria ser 10) e bloqueia o botão **Aprovar** porque exige 31 fotos. A detecção do tipo até funciona para montar as categorias, mas o **contador total** e a **validação** usam a constante hardcoded `TOTAL_FOTOS_OBRIGATORIAS` (calculada só para automóvel = 31).

Evidência (screenshot): "Foto 8 de 10 — 10/10 enviadas" no carrossel (lista correta de moto), mas o cabeçalho diz "4/31 fotos" e o botão Aprovar fica desabilitado com aviso "faltam 27".

## Causa

`src/pages/instalador/ExecutarVistoriaCompleta.tsx`:

- Linha 34: importa `TOTAL_FOTOS_OBRIGATORIAS` (constante global = 31, ignora tipo).
- Linha 258–263: `totalFotosEnviadas` filtra `FOTOS_VISTORIA_COMPLETA` (lista de carro), não usa `getFotosByTipoVeiculo(tipoVeiculoDetectado)`.
- Linha 267: `todasFotosEnviadas = totalFotosEnviadas >= TOTAL_FOTOS_OBRIGATORIAS` — sempre exige 31.
- Linhas 492 e 634: exibem `TOTAL_FOTOS_OBRIGATORIAS` direto na UI.

`tipoVeiculoDetectado` (linha 222) já existe e está correto — só não é propagado para o cálculo de total.

## Correção

### Único arquivo: `src/pages/instalador/ExecutarVistoriaCompleta.tsx`

1. Trocar import: remover `TOTAL_FOTOS_OBRIGATORIAS` e `FOTOS_VISTORIA_COMPLETA`; adicionar `getTotalFotosObrigatorias` e `getFotosFiltradas`.
2. Derivar dinâmico:
   ```ts
   const totalFotosObrigatorias = useMemo(
     () => getTotalFotosObrigatorias(tipoVeiculoDetectado),
     [tipoVeiculoDetectado]
   );
   ```
3. Reescrever `totalFotosEnviadas` para filtrar pela lista do tipo correto:
   ```ts
   const fotosObrigatoriasDoTipo = useMemo(
     () => getFotosFiltradas(tipoVeiculoDetectado, false),
     [tipoVeiculoDetectado]
   );
   const totalFotosEnviadas = useMemo(
     () => fotosObrigatoriasDoTipo.filter(f => fotosMap[f.id]).length,
     [fotosObrigatoriasDoTipo, fotosMap]
   );
   ```
4. Substituir todas as ocorrências de `TOTAL_FOTOS_OBRIGATORIAS` por `totalFotosObrigatorias` (linhas 267, 492, 497, 634).

Não mexer em: detecção de tipo (já correta), categorias, upload, RPC, banco. Mesmo padrão já consolidado em `InstaladorChecklist.tsx`.

## Validação

1. Abrir vistoria de moto → cabeçalho deve mostrar `X/10 fotos` (não `/31`).
2. Após enviar as 10 fotos + vídeo + conferência → botão **Aprovar** habilita.
3. Vistoria de carro → mantém `X/31` (regressão zero).

## Resultado

Técnico consegue finalizar vistoria de moto com 10 fotos (e qualquer outra contagem específica de tipo). Comportamento de carro inalterado.

