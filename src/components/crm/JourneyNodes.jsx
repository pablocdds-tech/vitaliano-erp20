import React from 'react';
import { Handle, Position } from 'reactflow';
import { Zap, Clock, HelpCircle, MessageSquare } from 'lucide-react';

export const TriggerNode = ({ data }) => {
  return (
    <div className="bg-purple-100 border-2 border-purple-500 rounded-md p-3 min-w-[180px] shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold text-sm">
        <Zap className="w-4 h-4" /> Gatilho Inicial
      </div>
      <div className="text-xs text-slate-700 bg-white p-2 rounded border border-purple-200">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500" />
    </div>
  );
};

export const WaitNode = ({ data }) => {
  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-md p-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-400" />
      <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-sm">
        <Clock className="w-4 h-4" /> Aguardar
      </div>
      <div className="text-xs text-slate-700 bg-white p-2 rounded border border-amber-200">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-400" />
    </div>
  );
};

export const ConditionNode = ({ data }) => {
  return (
    <div className="bg-blue-50 border-2 border-blue-400 rounded-md p-3 min-w-[180px] shadow-sm relative mb-4">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-400" />
      <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-sm">
        <HelpCircle className="w-4 h-4" /> Condição
      </div>
      <div className="text-xs text-slate-700 bg-white p-2 rounded border border-blue-200">{data.label}</div>
      
      {/* Verdadeiro */}
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} className="w-3 h-3 bg-emerald-500" />
      <div className="absolute -bottom-6 left-[15%] text-[10px] text-emerald-600 font-bold bg-white px-1 rounded-sm border border-emerald-200">Sim</div>
      
      {/* Falso */}
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} className="w-3 h-3 bg-red-500" />
      <div className="absolute -bottom-6 left-[65%] text-[10px] text-red-600 font-bold bg-white px-1 rounded-sm border border-red-200">Não</div>
    </div>
  );
};

export const WhatsappNode = ({ data }) => {
  return (
    <div className="bg-emerald-50 border-2 border-emerald-500 rounded-md p-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500" />
      <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-sm">
        <MessageSquare className="w-4 h-4" /> Enviar WhatsApp
      </div>
      <div className="text-xs text-slate-700 bg-white p-2 rounded border border-emerald-200">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
};

export const nodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
  condition: ConditionNode,
  whatsapp: WhatsappNode,
};