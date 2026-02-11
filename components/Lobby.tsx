
import React, { useState } from 'react';

interface LobbyProps {
  initialNickname: string;
  initialRoomId: string;
  onCreate: (nick: string) => void;
  onJoin: (nick: string, roomId: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ initialNickname, initialRoomId, onCreate, onJoin }) => {
  const [nick, setNick] = useState(initialNickname);
  const [joinId, setJoinId] = useState(initialRoomId);

  const isValid = nick.trim().length >= 2;

  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="mb-8 text-center">
          <div className="inline-block p-3 rounded-2xl bg-indigo-500/10 mb-4">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">BPM Battle</h1>
          <p className="text-slate-400">Match the rhythm, dominate the ranks.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 px-1">Your Nickname</label>
            <input 
              type="text" 
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Enter name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              maxLength={15}
            />
          </div>

          <div className="pt-2 grid grid-cols-1 gap-4">
            <button 
              disabled={!isValid}
              onClick={() => onCreate(nick)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-60H6" /></svg>
              Create New Game
            </button>
            
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-slate-800"></div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">or join room</span>
              <div className="flex-1 h-px bg-slate-800"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Room ID"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <button 
                disabled={!isValid || !joinId}
                onClick={() => onJoin(nick, joinId)}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-6 py-3 rounded-xl active:scale-95 transition-all"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-center text-slate-600 text-sm">
        No server needed. Pure Peer-to-Peer.
      </p>
    </div>
  );
};

export default Lobby;
