import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KeyRound, CheckCircle2, Coffee, LogIn, LogOut, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import useFaceApi from '@/components/ponto/useFaceApi';
import { getProximoTipoPorStatus, getNovoStatus, getMensagemConfirmacao, getTipoConfig } from '@/components/ponto/pontoUtils';
import KioskPinPad from '@/components/ponto/KioskPinPad';
import KioskConfirmation from '@/components/ponto/KioskConfirmation';

const COOLDOWN_MS = 180000; // 3 minutes
const IDLE_TIMEOUT_MS = 300000; // 5 minutes

export default function PontoKiosk() {
  const [time, setTime] = useState(new Date());
  const [status, setStatus] = useState('aguardando'); // aguardando | reconhecendo | confirmando | pin
  const [confirmData, setConfirmData] = useState(null);
  const [idle, setIdle] = useState(false);
  const [faceStatus, setFaceStatus] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionRef = useRef(null);
  const cooldownMap = useRef({});
  const idleTimerRef = useRef(null);
  const qc = useQueryClient();

  const { loaded, loadFaceApi } = useFaceApi();

  const { data: funcPontos = [] } = useQuery({
    queryKey: ['kiosk-func-pontos'],
    queryFn: () => base44.entities.FuncionarioPonto.list(),
    refetchInterval: 30000,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['kiosk-funcionarios'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }),
  });

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const { data: pontosHoje = [] } = useQuery({
    queryKey: ['kiosk-pontos-hoje', hoje],
    queryFn: () => base44.entities.RegistroPonto.filter({ data: hoje }),
    refetchInterval: 30000,
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['kiosk-lojas'],
    queryFn: () => base44.entities.Loja.filter({ status: 'ativo' }),
  });

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Idle detection
  const resetIdle = useCallback(() => {
    setIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    resetIdle();
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('touchstart', resetIdle);
    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle]);

  // Start camera + face detection
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const ok = await loadFaceApi();
      if (!ok || !mounted) return;
      await startCamera();
      startDetection();
    };
    init();
    return () => { mounted = false; stopDetection(); stopCamera(); };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const stopDetection = () => {
    if (detectionRef.current) { clearInterval(detectionRef.current); detectionRef.current = null; }
  };

  const startDetection = () => {
    if (detectionRef.current) return;
    detectionRef.current = setInterval(async () => {
      if (status !== 'aguardando' || !videoRef.current || videoRef.current.readyState < 2) return;
      
      const faceapi = window.faceapi;
      if (!faceapi) return;

      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      ).withFaceLandmarks().withFaceDescriptors();

      if (detections.length === 1) {
        resetIdle();
        setFaceStatus('Rosto detectado — identificando...');
        await matchFace(detections[0].descriptor);
      } else if (detections.length > 1) {
        setFaceStatus('Múltiplos rostos detectados. Apenas um por vez.');
      } else {
        setFaceStatus('');
      }
    }, 500);
  };

  const matchFace = async (descriptor) => {
    const faceapi = window.faceapi;
    const cadastrados = funcPontos.filter(fp => fp.face_cadastro_completo && fp.face_descriptors?.length > 0);
    if (cadastrados.length === 0) { setFaceStatus('Nenhum cadastro facial encontrado.'); return; }

    try {
      const labeled = cadastrados.map(fp => {
        const descs = fp.face_descriptors.map(d => new Float32Array(d.descriptor));
        return new faceapi.LabeledFaceDescriptors(fp.funcionario_id, descs);
      });

      const matcher = new faceapi.FaceMatcher(labeled, 0.5);
      const result = matcher.findBestMatch(descriptor);

      if (result.label !== 'unknown' && result.distance < 0.5) {
        const funcId = result.label;
        // Cooldown check
        if (cooldownMap.current[funcId] && Date.now() - cooldownMap.current[funcId] < COOLDOWN_MS) {
          setFaceStatus('Ponto já registrado recentemente. Aguarde 3 minutos.');
          return;
        }
        const confianca = 1 - result.distance;
        await registrarPonto(funcId, 'facial', confianca);
      }
    } catch (err) {
      console.error('Match error:', err);
    }
  };

  const registrarPonto = async (funcId, metodo, confianca) => {
    setStatus('reconhecendo');
    stopDetection();

    const fp = funcPontos.find(f => f.funcionario_id === funcId);
    const func = funcionarios.find(f => f.id === funcId);
    const pontosFunc = pontosHoje.filter(p => p.funcionario_id === funcId);
    const tipo = getProximoTipoPorStatus(fp?.status_atual, pontosFunc);
    const novoStatus = getNovoStatus(tipo);

    // Capture photo
    let fotoUrl = null;
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
      if (blob) {
        const file = new File([blob], `kiosk_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const result = await base44.integrations.Core.UploadFile({ file });
        fotoUrl = result.file_url;
      }
    }

    await base44.entities.RegistroPonto.create({
      funcionario_id: funcId,
      data: format(new Date(), 'yyyy-MM-dd'),
      tipo,
      horario: new Date().toISOString(),
      foto_url: fotoUrl,
      confianca_reconhecimento: confianca || null,
      metodo_autenticacao: metodo,
    });

    // Update status
    if (fp) {
      await base44.entities.FuncionarioPonto.update(fp.id, { status_atual: novoStatus, ultima_marcacao: new Date().toISOString() });
    }

    cooldownMap.current[funcId] = Date.now();
    qc.invalidateQueries({ queryKey: ['kiosk-pontos-hoje'] });
    qc.invalidateQueries({ queryKey: ['kiosk-func-pontos'] });

    setConfirmData({
      nome: func?.nome || 'Colaborador',
      foto: fp?.foto_perfil_url || null,
      tipo,
      horario: format(new Date(), 'HH:mm'),
      mensagem: getMensagemConfirmacao(tipo, func?.nome),
    });
    setStatus('confirmando');

    setTimeout(() => {
      setStatus('aguardando');
      setConfirmData(null);
      startDetection();
    }, 4000);
  };

  const handlePinSuccess = async (funcId) => {
    await registrarPonto(funcId, 'pin_backup', null);
  };

  const tipoIcon = (tipo) => {
    switch (tipo) {
      case 'entrada': return <LogIn className="w-8 h-8" />;
      case 'saida_descanso': return <Coffee className="w-8 h-8" />;
      case 'volta_descanso': return <ArrowLeftRight className="w-8 h-8" />;
      case 'saida': return <LogOut className="w-8 h-8" />;
      default: return <CheckCircle2 className="w-8 h-8" />;
    }
  };

  const lojaName = lojas[0]?.nome || 'Unidade';

  return (
    <div className={`fixed inset-0 bg-slate-900 text-white flex flex-col transition-opacity duration-500 ${idle ? 'opacity-30' : 'opacity-100'}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-4 bg-slate-950 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{lojaName}</h1>
          <p className="text-xs text-slate-400">Ponto Eletrônico</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black tabular-nums tracking-tighter">{format(time, 'HH:mm:ss')}</div>
          <p className="text-xs text-slate-400 capitalize">{format(time, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {status === 'confirmando' && confirmData ? (
          <KioskConfirmation data={confirmData} tipoIcon={tipoIcon} />
        ) : status === 'pin' ? (
          <KioskPinPad
            funcPontos={funcPontos}
            funcionarios={funcionarios}
            onSuccess={handlePinSuccess}
            onCancel={() => setStatus('aguardando')}
          />
        ) : (
          <div className="w-full max-w-xl">
            <div className={`relative rounded-2xl overflow-hidden border-4 transition-colors duration-300 ${
              faceStatus.includes('identificando') ? 'border-emerald-500 shadow-lg shadow-emerald-500/30' : 'border-slate-700'
            }`}>
              <video ref={videoRef} className="w-full aspect-square object-cover transform -scale-x-100" autoPlay playsInline muted />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-56 h-72 rounded-[120px] border-4 border-dashed transition-colors duration-300 ${
                  faceStatus.includes('identificando') ? 'border-emerald-400' : 'border-white/20'
                }`} />
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Status text */}
            <div className="mt-6 text-center">
              {faceStatus ? (
                <p className="text-lg font-medium text-emerald-400 animate-pulse">{faceStatus}</p>
              ) : (
                <p className="text-lg text-slate-400">Posicione seu rosto para registrar o ponto</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end px-8 py-4 bg-slate-950 border-t border-slate-800">
        {status === 'aguardando' && (
          <Button
            variant="ghost"
            onClick={() => setStatus('pin')}
            className="text-slate-400 hover:text-white gap-2"
          >
            <KeyRound className="w-4 h-4" /> Usar PIN
          </Button>
        )}
      </div>
    </div>
  );
}