import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regressão: o detalhe do associado NÃO pode ser aberto dentro de um Dialog
 * aninhado na listagem `/cadastro/associados`. Quando isso ocorria, o
 * MediaViewerModal (outro Dialog Radix) ficava bloqueado pelo overlay do
 * dialog externo e os documentos não abriam ao clicar.
 *
 * A correção navega para a rota dedicada `/cadastro/associados/:id`, que
 * renderiza `AssociadoDetalhe` em página própria — permitindo que qualquer
 * modal interno (mídia, contrato, etc.) funcione sem conflito de portais.
 */
describe("Associados — sem Dialog aninhado de detalhe", () => {
  const file = fs.readFileSync(
    path.resolve(__dirname, "Associados.tsx"),
    "utf8"
  );

  it("não importa AssociadoDetalhe na listagem", () => {
    expect(file).not.toMatch(/from\s+['"]\.\/AssociadoDetalhe['"]/);
  });

  it("não declara o estado detalheAssociadoId", () => {
    expect(file).not.toMatch(/detalheAssociadoId/);
  });

  it("usa navigate para abrir a rota dedicada do associado", () => {
    expect(file).toMatch(/navigate\(`\/cadastro\/associados\/\$\{associado\.id\}`\)/);
  });

  it("não renderiza Dialog wrapper para o detalhe do associado", () => {
    // Garante que o bloco antigo (<Dialog open={!!detalheAssociadoId}>) sumiu
    expect(file).not.toMatch(/Dialog\s+open=\{!!detalheAssociadoId/);
  });
});
