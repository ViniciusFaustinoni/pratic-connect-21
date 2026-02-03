import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, User, Mail, Phone, Hash, Info } from 'lucide-react';
import { useUpdateConsultor, type Consultor } from '@/hooks/useConsultores';

interface ConsultorEditSheetProps {
  consultor: Consultor | null;
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  vendedor_clt: 'Vendedor CLT',
  vendedor_externo: 'Vendedor Externo',
  supervisor_vendas: 'Supervisor',
  gerente_comercial: 'Gerente',
};

export function ConsultorEditSheet({ consultor, open, onClose }: ConsultorEditSheetProps) {
  const [codigoSga, setCodigoSga] = useState('');
  const updateConsultor = useUpdateConsultor();

  useEffect(() => {
    if (consultor) {
      setCodigoSga(consultor.codigo_sga_voluntario || '');
    }
  }, [consultor]);

  const handleSave = async () => {
    if (!consultor) return;

    await updateConsultor.mutateAsync({
      id: consultor.id,
      codigo_sga_voluntario: codigoSga.trim() || null,
    });
    
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (!consultor) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Consultor
          </SheetTitle>
          <SheetDescription>
            Atualize as informações do consultor
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Info do Consultor */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <Avatar className="h-16 w-16">
              <AvatarImage src={consultor.avatar_url || ''} alt={consultor.nome} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {getInitials(consultor.nome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{consultor.nome}</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {consultor.roles.map(role => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {ROLE_LABELS[role] || role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Dados de Contato (somente leitura) */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{consultor.email || 'Sem e-mail'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{consultor.telefone || 'Sem telefone'}</span>
            </div>
          </div>

          {/* Separador */}
          <div className="border-t" />

          {/* Código SGA Voluntário */}
          <div className="space-y-2">
            <Label htmlFor="codigo_sga" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Código SGA Voluntário
            </Label>
            <Input
              id="codigo_sga"
              placeholder="Ex: 12345"
              value={codigoSga}
              onChange={(e) => setCodigoSga(e.target.value)}
              maxLength={20}
            />
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Este código será usado na API Hinova para sincronizar veículos vendidos por este consultor. 
                Se não preenchido, será usado o código global da integração.
              </p>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateConsultor.isPending}>
            {updateConsultor.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
