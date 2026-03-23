import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Clock, Camera, MapPin, CheckCircle2, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PontoRegistroCard from '@/components/rh/PontoRegistroCard';
import PontoHistorico from '@/components/rh/PontoHistorico';
import RelatorioPonto from '@/components/rh/RelatorioPonto';

const TIPOS_PONTO = [
  { value: 'entrada', label: '🟢 Entrada', color: 'bg-emerald-500' },
  { value: 'saida_almoco', label: '🟡 Saída Intervalo', color: 'bg-amber-500' },
  { value: 'volta_almoco', label: '🔵 Volta Intervalo', color: 'bg-blue-500' },
  { value: 'saida', label: '🔴 Saída', color: 'bg-red-500' }
];

export default function RHPontoEletronico() {
  return (
    <div>
      <PageHeader
        title="Ponto Eletrônico"
        subtitle="Registro de ponto com foto e geolocalização"
        icon={Clock}
        breadcrumbs={[{ label: 'RH', href: '/RHFuncionarios' }, { label: 'Ponto Eletrônico' }]}
      />

      <Tabs defaultValue="registrar">
        <TabsList className="mb-4">
          <TabsTrigger value="registrar">Registrar Ponto</TabsTrigger>
          <TabsTrigger value="historico">Histórico / Auditoria</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="registrar">
          <PontoRegistroCard tiposPonto={TIPOS_PONTO} />
        </TabsContent>

        <TabsContent value="historico">
          <PontoHistorico />
        </TabsContent>

        <TabsContent value="relatorio">
          <RelatorioPonto />
        </TabsContent>
      </Tabs>
    </div>
  );
}