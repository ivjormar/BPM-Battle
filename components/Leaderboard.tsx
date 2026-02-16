
import React from 'react';
import { Player } from '../types';

interface LeaderboardProps {
  players: Player[];
  targetBpm?: number;
  mode: 'BPM' | 'ROUND' | 'TOTAL';
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, targetBpm, mode }) => {
  const sortedPlayers = [...players].sort((a, b) => {
    if (mode === 'BPM' && targetBpm) {
      return Math.abs(a.bpm - targetBpm) - Math.abs(b.bpm - targetBpm);
    }
    if (mode === 'ROUND') return b.roundScore - a.roundScore;
    return b.totalScore - a.totalScore;
  });

  return (
    <div className="space-y-3">
      {sortedPlayers.length === 0 && (
        <p className="text-slate-400 text-sm italic text-center py-8">Esperando jugadores...</p>
      )}
      {sortedPlayers.map((player, idx) => {
        const diff = targetBpm ? Math.abs(player.bpm - targetBpm) : 0;
        
        return (
          <div 
            key={player.id} 
            className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-100 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                {idx + 1}
              </div>
              <div>
                <span className="font-bold text-slate-800 block">{player.nickname}</span>
                {mode === 'BPM' && (
                  <span className={`text-[10px] font-bold uppercase ${diff === 0 ? 'text-green-600' : diff <= 2 ? 'text-orange-500' : 'text-slate-400'}`}>
                    Diferencia: {diff}
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-right">
              {mode === 'BPM' ? (
                <span className="text-2xl font-black mono text-slate-900">
                  {player.bpm} <span className="text-[10px] text-slate-400">BPM</span>
                </span>
              ) : mode === 'ROUND' ? (
                <span className="text-2xl font-black mono text-indigo-600">
                  +{player.roundScore} <span className="text-[10px] text-slate-400">PTS</span>
                </span>
              ) : (
                <span className="text-2xl font-black mono text-slate-900">
                  {player.totalScore} <span className="text-[10px] text-slate-400">TOTAL</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Leaderboard;