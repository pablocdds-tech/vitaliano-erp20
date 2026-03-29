import React from 'react';
import { motion } from 'framer-motion';
import { getTipoConfig } from './pontoUtils';

const colorMap = {
  emerald: 'from-emerald-500 to-emerald-700',
  amber: 'from-amber-500 to-amber-700',
  blue: 'from-blue-500 to-blue-700',
  red: 'from-red-500 to-red-700',
};

export default function KioskConfirmation({ data, tipoIcon }) {
  const tipoConfig = getTipoConfig(data.tipo);
  const gradientClass = colorMap[tipoConfig.color] || colorMap.emerald;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-center"
    >
      <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${gradientClass} mb-6 shadow-2xl`}>
        {tipoIcon(data.tipo)}
      </div>

      {data.foto && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 mx-auto mb-4 shadow-xl"
        >
          <img src={data.foto} className="w-full h-full object-cover" alt="" />
        </motion.div>
      )}

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-black mb-2"
      >
        {data.nome}
      </motion.h2>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <span className={`inline-block px-4 py-2 rounded-full bg-gradient-to-r ${gradientClass} text-white text-lg font-bold mb-3`}>
          {tipoConfig.icon} {tipoConfig.label}
        </span>
        <p className="text-2xl font-bold text-white/90 mb-2">{data.horario}</p>
        <p className="text-lg text-slate-300">{data.mensagem}</p>
      </motion.div>
    </motion.div>
  );
}