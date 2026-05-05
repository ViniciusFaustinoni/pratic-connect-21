import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaViewerModal, type MediaItem } from "@/components/cadastro/MediaViewerModal";

describe("MediaViewerModal", () => {
  const items: MediaItem[] = [
    { url: "https://example.com/foto.jpg", tipo: "Frente", mediaType: "image" },
    { url: "https://example.com/laudo.pdf", tipo: "Laudo", mediaType: "pdf" },
  ];

  it("não renderiza nada quando não há itens", () => {
    const { container } = render(
      <MediaViewerModal open items={[]} onOpenChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza imagem do item atual quando aberto", () => {
    render(
      <MediaViewerModal open items={items} initialIndex={0} onOpenChange={() => {}} />
    );
    const img = screen.getByAltText("Frente") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("foto.jpg");
  });

  it("renderiza iframe de PDF quando o tipo é pdf", () => {
    const { container } = render(
      <MediaViewerModal open items={items} initialIndex={1} onOpenChange={() => {}} />
    );
    const iframe = container.querySelector('iframe[title="Laudo"]') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.src).toContain("laudo.pdf");
  });

  it("expõe link 'Abrir em nova aba' apontando para a URL atual", () => {
    render(
      <MediaViewerModal open items={items} initialIndex={0} onOpenChange={() => {}} />
    );
    const link = screen.getByTitle("Abrir em nova aba") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.com/foto.jpg");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
