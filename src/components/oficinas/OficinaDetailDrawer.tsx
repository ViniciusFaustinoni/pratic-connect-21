import { useState } from 'react';
import { MapPin, Phone, Mail, Building2, CreditCard, Pencil } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OficinaFormDialog } from './OficinaFormDialog';
import { STATUS_OFICINA_LABELS, STATUS_OFICINA_COLORS, type Oficina } from '@/types/database';

interface Props {
  oficina: Oficina | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OficinaDetailDrawer({ oficina, open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  if (!oficina) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle>{oficina.nome_fantasia || oficina.razao_social}</SheetTitle>
                <p className="text-sm text-muted-foreground">{oficina.cnpj}</p>
              </div>
              <Badge className={STATUS_OFICINA_COLORS[oficina.status]}>
                {STATUS_OFICINA_LABELS[oficina.status]}
              </Badge>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Contato */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-medium">
                <Phone className="h-4 w-4" />
                Contato
              </h3>
              <div className="space-y-2 text-sm">
                {oficina.telefone && (
                  <p>
                    <span className="text-muted-foreground">Telefone:</span> {oficina.telefone}
                  </p>
                )}
                {oficina.whatsapp && (
                  <p>
                    <span className="text-muted-foreground">WhatsApp:</span> {oficina.whatsapp}
                  </p>
                )}
                {oficina.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{oficina.email}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-medium">
                <MapPin className="h-4 w-4" />
                Endereço
              </h3>
              <div className="space-y-1 text-sm">
                {oficina.logradouro && (
                  <p>
                    {oficina.logradouro}
                    {oficina.numero && `, ${oficina.numero}`}
                    {oficina.complemento && ` - ${oficina.complemento}`}
                  </p>
                )}
                {oficina.bairro && <p>{oficina.bairro}</p>}
                <p>
                  {oficina.cidade} - {oficina.estado}
                  {oficina.cep && ` | CEP: ${oficina.cep}`}
                </p>
              </div>
            </div>

            <Separator />

            {/* Dados Bancários */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-medium">
                <CreditCard className="h-4 w-4" />
                Dados Bancários
              </h3>
              <div className="space-y-2 text-sm">
                {oficina.banco && (
                  <p>
                    <span className="text-muted-foreground">Banco:</span> {oficina.banco}
                  </p>
                )}
                {oficina.agencia && (
                  <p>
                    <span className="text-muted-foreground">Agência:</span> {oficina.agencia}
                  </p>
                )}
                {oficina.conta && (
                  <p>
                    <span className="text-muted-foreground">Conta:</span> {oficina.conta}
                  </p>
                )}
                {oficina.pix_chave && (
                  <p>
                    <span className="text-muted-foreground">PIX ({oficina.pix_tipo}):</span>{' '}
                    {oficina.pix_chave}
                  </p>
                )}
              </div>
            </div>

            {/* Especialidades */}
            {oficina.especialidades?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4" />
                    Especialidades
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {oficina.especialidades.map((esp) => (
                      <Badge key={esp} variant="outline">
                        {esp}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Marcas Atendidas */}
            {(oficina as any).marcas_atendidas?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-medium">Marcas Atendidas</h3>
                  <div className="flex flex-wrap gap-2">
                    {(oficina as any).marcas_atendidas.includes('GLOBAL') ? (
                      <Badge className="bg-primary text-primary-foreground">GLOBAL</Badge>
                    ) : (
                      (oficina as any).marcas_atendidas.map((m: string) => (
                        <Badge key={m} variant="secondary">{m}</Badge>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <Button className="w-full" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Oficina
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <OficinaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        oficina={oficina}
      />
    </>
  );
}
