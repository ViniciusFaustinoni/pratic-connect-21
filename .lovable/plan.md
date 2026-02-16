

# Exibir Endereco Completo do Evento na Tela de Analise

## O que sera feito

Adicionar os campos de endereco preenchidos pelo associado (rua, numero, bairro, cidade, UF e ponto de referencia) na secao "Boletim de Ocorrencia" da tela de analise do evento (`EventoAnaliseDetalhe`). Esses dados ja existem em `dadosEtapa2` (preenchidos na etapa do B.O. via link do evento) -- apenas nao estao sendo exibidos.

## Alteracao

### Arquivo: `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx`

Na secao do Boletim de Ocorrencia (apos o numero do B.O. e resumo, antes do documento), adicionar um bloco com o endereco completo:

- **Rua e Numero**: `dadosEtapa2.endereco_rua`, `dadosEtapa2.endereco_numero`
- **Bairro**: `dadosEtapa2.endereco_bairro`
- **Cidade/UF**: `dadosEtapa2.endereco_cidade` - `dadosEtapa2.endereco_uf`
- **Ponto de Referencia**: `dadosEtapa2.endereco_ponto_referencia`

O bloco so aparece se ao menos a rua estiver preenchida. Sera exibido com icone de MapPin e fundo suave para destaque visual.

| Arquivo | Alteracao |
|---|---|
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Adicionar exibicao do endereco do evento (rua, bairro, cidade/UF, ponto de referencia) na secao B.O. |

