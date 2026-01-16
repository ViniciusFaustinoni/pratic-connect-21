import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAutentiqueDocumento } from '@/hooks/useAutentiqueDocumento';
import { Plus, Trash2, Send, User, Mail, Phone, Loader2, FileSignature } from 'lucide-react';
import { toast } from 'sonner';

interface Signatario {
  nome: string;
  email: string;
  telefone?: string;
  funcao: 'assinar' | 'testemunha' | 'aprovar';
}

interface ModalEnviarAssinaturaProps {
  open: boolean;
  onClose: () => void;
  documentoGeradoId: string;
  nomeDocumento: string;
  pdfBytes: Uint8Array;
  associado?: {
    nome: string;
    email: string;
    telefone?: string;
  };
  onSuccess?: (linkAssinatura: string) => void;
}

export function ModalEnviarAssinatura({
  open,
  onClose,
  documentoGeradoId,
  nomeDocumento,
  pdfBytes,
  associado,
  onSuccess,
}: ModalEnviarAssinaturaProps) {
  const { enviarParaAssinatura, arrayBufferToBase64, enviando } = useAutentiqueDocumento();

  const [signatarios, setSignatarios] = useState<Signatario[]>([]);
  const [mensagem, setMensagem] = useState('Por favor, leia e assine o documento anexo.');
  const [prazoHoras, setPrazoHoras] = useState(168); // 7 dias

  // Pré-preencher com dados do associado
  useEffect(() => {
    if (associado && open) {
      setSignatarios([
        {
          nome: associado.nome,
          email: associado.email || '',
          telefone: associado.telefone,
          funcao: 'assinar',
        },
      ]);
    }
  }, [associado, open]);

  const adicionarSignatario = () => {
    setSignatarios([
      ...signatarios,
      { nome: '', email: '', telefone: '', funcao: 'assinar' },
    ]);
  };

  const removerSignatario = (index: number) => {
    setSignatarios(signatarios.filter((_, i) => i !== index));
  };

  const atualizarSignatario = (index: number, campo: keyof Signatario, valor: string) => {
    const novos = [...signatarios];
    novos[index] = { ...novos[index], [campo]: valor };
    setSignatarios(novos);
  };

  const handleEnviar = async () => {
    // Validações
    if (signatarios.length === 0) {
      toast.error('Adicione pelo menos um signatário');
      return;
    }

    const invalidos = signatarios.filter(s => !s.nome || !s.email);
    if (invalidos.length > 0) {
      toast.error('Preencha nome e email de todos os signatários');
      return;
    }

    // Converter PDF para Base64
    const pdfBase64 = arrayBufferToBase64(pdfBytes);

    // Enviar
    const resultado = await enviarParaAssinatura({
      documentoGeradoId,
      nomeDocumento,
      pdfBase64,
      signatarios,
      mensagem,
      prazoHoras,
    });

    if (resultado.success) {
      onSuccess?.(resultado.linkAssinatura!);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Enviar para Assinatura Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info do Documento */}
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">Documento:</p>
              <p className="font-medium">{nomeDocumento}</p>
            </CardContent>
          </Card>

          {/* Signatários */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Signatários</Label>
              <Button variant="outline" size="sm" onClick={adicionarSignatario}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {signatarios.map((signatario, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">Signatário {index + 1}</Badge>
                      {signatarios.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerSignatario(index)}
                          className="text-destructive h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome *</Label>
                        <div className="relative">
                          <User className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Nome completo"
                            value={signatario.nome}
                            onChange={(e) => atualizarSignatario(index, 'nome', e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Email *</Label>
                        <div className="relative">
                          <Mail className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            value={signatario.email}
                            onChange={(e) => atualizarSignatario(index, 'email', e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Telefone (opcional)</Label>
                        <div className="relative">
                          <Phone className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="(00) 00000-0000"
                            value={signatario.telefone || ''}
                            onChange={(e) => atualizarSignatario(index, 'telefone', e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Função</Label>
                        <Select
                          value={signatario.funcao}
                          onValueChange={(v) => atualizarSignatario(index, 'funcao', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assinar">Assinar</SelectItem>
                            <SelectItem value="testemunha">Testemunha</SelectItem>
                            <SelectItem value="aprovar">Aprovar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {signatarios.length === 0 && (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-2">Nenhum signatário adicionado</p>
                  <Button variant="outline" size="sm" onClick={adicionarSignatario}>
                    Clique para adicionar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <Label>Mensagem para os signatários</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Mensagem que será enviada junto com o documento..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Prazo */}
          <div>
            <Label>Prazo para assinatura</Label>
            <Select value={String(prazoHoras)} onValueChange={(v) => setPrazoHoras(Number(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="72">3 dias</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
                <SelectItem value="336">14 dias</SelectItem>
                <SelectItem value="720">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={enviando || signatarios.length === 0}>
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar para Assinatura
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
