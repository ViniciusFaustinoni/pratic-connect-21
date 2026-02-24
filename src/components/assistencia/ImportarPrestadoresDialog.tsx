import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileJson, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parsePrestadoresJSON, type PrestadorValidado } from "@/lib/parsePrestador";
import { useImportPrestadores } from "@/hooks/useImportPrestadores";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Etapa = "upload" | "preview" | "importing" | "result";

export function ImportarPrestadoresDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { importar, isImporting, resultado, error, reset } = useImportPrestadores();
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [prestadores, setPrestadores] = useState<PrestadorValidado[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleClose = () => {
    setPrestadores([]);
    setParseError(null);
    setEtapa("upload");
    reset();
    onClose();
  };

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;

    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parsePrestadoresJSON(text);
        setPrestadores(parsed);
        setEtapa("preview");
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Erro ao ler arquivo");
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"] },
    maxFiles: 1,
  });

  const validos = prestadores.filter((p) => p.valido);
  const invalidos = prestadores.filter((p) => !p.valido);

  const handleImportar = async () => {
    setEtapa("importing");
    try {
      await importar(validos.map((p) => p.dados));
      setEtapa("result");
      queryClient.invalidateQueries({ queryKey: ["prestadores"] });
      queryClient.invalidateQueries({ queryKey: ["prestadores-metricas"] });
    } catch {
      setEtapa("result");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Prestadores</DialogTitle>
          <DialogDescription>
            Importe prestadores de assistência a partir de um arquivo JSON.
          </DialogDescription>
        </DialogHeader>

        {/* UPLOAD */}
        {etapa === "upload" && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <FileJson className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {isDragActive
                  ? "Solte o arquivo aqui..."
                  : "Arraste um arquivo .json ou clique para selecionar"}
              </p>
            </div>
            {parseError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* PREVIEW */}
        {etapa === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                {validos.length} válido(s)
              </Badge>
              {invalidos.length > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {invalidos.length} com erro(s)
                </Badge>
              )}
            </div>

            <ScrollArea className="max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead className="w-10">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prestadores.map((p) => (
                    <TableRow key={p.linha}>
                      <TableCell className="text-muted-foreground">{p.linha}</TableCell>
                      <TableCell className="font-medium">{p.dados.razao_social || "—"}</TableCell>
                      <TableCell>{p.dados.cidade}/{p.dados.estado}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.dados.tipos_servico.slice(0, 2).map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                          {p.dados.tipos_servico.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{p.dados.tipos_servico.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.valido ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <span title={p.erros.join("; ")}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {invalidos.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-destructive mb-1">Erros encontrados:</p>
                {invalidos.map((p) => (
                  <p key={p.linha}>Linha {p.linha}: {p.erros.join("; ")}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEtapa("upload"); setPrestadores([]); }}>
                Voltar
              </Button>
              <Button onClick={handleImportar} disabled={validos.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                Importar {validos.length} prestador(es)
              </Button>
            </div>
          </div>
        )}

        {/* IMPORTING */}
        {etapa === "importing" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Importando {validos.length} prestador(es)...</p>
          </div>
        )}

        {/* RESULT */}
        {etapa === "result" && (
          <div className="space-y-4">
            {error && !resultado && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}

            {resultado && (
              <>
                <div className="flex gap-3">
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    {resultado.sucesso} importado(s)
                  </Badge>
                  {resultado.erros > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      {resultado.erros} erro(s)
                    </Badge>
                  )}
                </div>

                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Razão Social</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.resultados.map((r) => (
                        <TableRow key={r.linha}>
                          <TableCell className="text-muted-foreground">{r.linha}</TableCell>
                          <TableCell>{r.razao_social}</TableCell>
                          <TableCell>{r.valores_inseridos ?? "—"}</TableCell>
                          <TableCell>
                            {r.sucesso ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-sm text-destructive">{r.erro}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
