
# Exibir todos os dados extraidos dos documentos (CNH e CRLV)

## Problema

A secao "Documentos Necessarios" mostra apenas um resumo minimo dos dados extraidos:
- **CNH**: apenas nome e CPF
- **CRLV**: apenas placa e renavam
- **Comprovante**: apenas endereco resumido

Os demais campos extraidos pelo OCR (RG, validade da CNH, categoria, chassi, cor, combustivel, motor, ano) nao sao exibidos.

## Solucao

Expandir a exibicao de cada documento para mostrar **todos os dados extraidos** pelo OCR, organizados de forma clara.

### Dados a exibir na CNH/RG:
- Nome completo
- CPF
- RG + Orgao emissor
- Data de nascimento
- Numero de registro da CNH
- Validade da CNH
- Categoria (A, B, AB, etc.)

### Dados a exibir no CRLV:
- Placa
- Renavam
- Chassi
- Cor
- Combustivel
- Motor
- Ano fabricacao / Ano modelo

### Layout

Cada card de documento tera, apos o check de sucesso, uma grade compacta (grid 2 colunas) com todos os campos extraidos formatados como `Label: Valor`, usando texto xs/muted para manter a interface limpa.

## Detalhe tecnico

### Arquivo: `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

**Linhas 386-420**: Substituir a exibicao resumida de CNH e CRLV por grids com todos os dados extraidos.

**CNH** (linhas 388-392): Trocar de:
```
{dadosExtraidos.nome} . CPF: {dadosExtraidos.cpf}
```
Para grid com: Nome, CPF, RG, Orgao, Data Nasc., N Registro CNH, Validade, Categoria.

**CRLV** (linhas 413-418): Trocar de:
```
Placa: {dadosExtraidos.veiculo_placa} . Renavam: {dadosExtraidos.veiculo_renavam}
```
Para grid com: Placa, Renavam, Chassi, Cor, Combustivel, Motor, Ano Fab/Mod.

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Expandir exibicao de dados extraidos para CNH e CRLV |
