import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Play, Clock, HelpCircle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { nodeTypes } from './JourneyNodes';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

let id = 0;
const getId = () => `dndnode_${id++}`;

const Sidebar = () => {
  const onDragStart = (event, nodeType, label) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 z-10 shadow-lg">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Ações Disponíveis</div>
      <div className="text-xs text-slate-500 mb-2">Arraste os blocos para a área ao lado para conectá-los na jornada</div>

      <div 
        className="bg-amber-50 border border-amber-200 p-3 rounded cursor-grab flex items-center gap-3 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors" 
        onDragStart={(e) => onDragStart(e, 'wait', 'Aguardar 1 dia')} 
        draggable
      >
        <div className="bg-white p-1.5 rounded-md"><Clock className="w-4 h-4" /></div>
        Aguardar Tempo
      </div>

      <div 
        className="bg-blue-50 border border-blue-200 p-3 rounded cursor-grab flex items-center gap-3 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors" 
        onDragStart={(e) => onDragStart(e, 'condition', 'Se comprou > 1 vez')} 
        draggable
      >
        <div className="bg-white p-1.5 rounded-md"><HelpCircle className="w-4 h-4" /></div>
        Condição (Sim/Não)
      </div>

      <div 
        className="bg-emerald-50 border border-emerald-200 p-3 rounded cursor-grab flex items-center gap-3 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors" 
        onDragStart={(e) => onDragStart(e, 'whatsapp', 'Enviar Template')} 
        draggable
      >
        <div className="bg-white p-1.5 rounded-md"><MessageSquare className="w-4 h-4" /></div>
        Enviar WhatsApp
      </div>
    </div>
  );
};

export default function JourneyBuilder({ journey, onBack }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(journey?.nodes?.length ? journey.nodes : [
    {
      id: 'trigger_1',
      type: 'trigger',
      data: { label: journey?.trigger_type === 'new_customer' ? 'Novo Cliente Cadastrado' : 'Disparo de Evento' },
      position: { x: 250, y: 50 },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(journey?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const qc = useQueryClient();

  const { mutate: saveJourney, isPending } = useMutation({
    mutationFn: (data) => base44.entities.CRMJourney.update(journey.id, data),
    onSuccess: () => {
      toast.success('Fluxo da jornada salvo com sucesso!');
      qc.invalidateQueries({ queryKey: ['crm-journeys'] });
    },
    onError: (err) => toast.error('Erro ao salvar: ' + err.message)
  });

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#64748b', strokeWidth: 2 } }, eds)), [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleSave = () => {
    saveJourney({
      nodes,
      edges
    });
  };

  const handleActivate = () => {
    base44.entities.CRMJourney.update(journey.id, { status: 'active', nodes, edges })
      .then(() => {
        toast.success('Jornada ativada e em execução!');
        qc.invalidateQueries({ queryKey: ['crm-journeys'] });
        onBack();
      });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -m-4 sm:-m-6">
      {/* Header do Builder */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-bold text-lg leading-tight">{journey?.name || 'Nova Jornada'}</h2>
            <div className="text-xs text-slate-500 font-medium">Construtor de Automação Visual</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleSave} disabled={isPending}>
            <Save className="w-4 h-4" /> {isPending ? 'Salvando...' : 'Salvar Fluxo'}
          </Button>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleActivate}>
            <Play className="w-4 h-4" /> Ativar Jornada
          </Button>
        </div>
      </div>

      {/* Area de Trabalho */}
      <div className="flex-1 flex overflow-hidden relative">
        <ReactFlowProvider>
          <div className="flex-1 h-full relative bg-slate-50" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
              defaultEdgeOptions={{ style: { stroke: '#64748b', strokeWidth: 2 } }}
            >
              <Background color="#cbd5e1" gap={16} size={2} />
              <Controls className="bg-white rounded-md shadow-md border border-slate-200" />
              <MiniMap className="rounded-md border border-slate-200 shadow-sm" zoomable pannable />
            </ReactFlow>
          </div>
          <Sidebar />
        </ReactFlowProvider>
      </div>
    </div>
  );
}