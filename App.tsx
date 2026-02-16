
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PeerMessage, GameStatus, RoundStatus } from './types';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

declare var Peer: any;

const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>(localStorage.getItem('bpm-nick') || '');
  const [status, setStatus] = useState<GameStatus>('LOBBY');
  const [roundStatus, setRoundStatus] = useState<RoundStatus>('CONFIG');
  const [peerId, setPeerId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pendingPlayers, setPendingPlayers] = useState<{id: string, nickname: string}[]>([]);
  const [targetBpm, setTargetBpm] = useState(120);
  const [roundDuration, setRoundDuration] = useState(15);
  const [timer, setTimer] = useState(0);
  const [lastLocalTap, setLastLocalTap] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);

  const peerRef = useRef<any>(null);
  const connectionsRef = useRef<Map<string, any>>(new Map());
  const playersRef = useRef<Player[]>([]);
  const stateRef = useRef({ status, roundStatus, targetBpm, roundDuration, timer, isHost, peerId, roomId });

  useEffect(() => {
    playersRef.current = players;
    stateRef.current = { status, roundStatus, targetBpm, roundDuration, timer, isHost, peerId, roomId };
  }, [players, status, roundStatus, targetBpm, roundDuration, timer, isHost, peerId, roomId]);

  const broadcast = useCallback((msg: PeerMessage) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }, []);

  const handleMessage = useCallback((msg: PeerMessage) => {
    console.log("[DEBUG] Recibido mensaje tipo:", msg.type, "desde:", msg.senderId);
    const s = stateRef.current;

    switch (msg.type) {
      case 'PLAYER_JOIN_REQUEST':
        console.log("[DEBUG] Petición de unión aceptada en lógica de Host para:", msg.payload.nickname);
        setPendingPlayers(prev => {
          if (prev.find(p => p.id === msg.senderId)) return prev;
          return [...prev, { id: msg.senderId, nickname: msg.payload.nickname }];
        });
        break;

      case 'PLAYER_JOIN_RESPONSE':
        if (msg.payload.accepted) {
          setStatus('ROOM');
          setJoinError(null);
        } else {
          setJoinError(msg.payload.message || 'Entrada denegada');
          setTimeout(() => leaveGame(), 3000);
        }
        break;

      case 'STATE_UPDATE':
        setPlayers(msg.payload.players);
        setTargetBpm(msg.payload.targetBpm);
        setStatus(msg.payload.status);
        setRoundStatus(msg.payload.roundStatus);
        setRoundDuration(msg.payload.roundDuration);
        setTimer(msg.payload.timer);
        break;

      case 'PLAYER_STAT_UPDATE':
        const updated = playersRef.current.map(p => p.id === msg.senderId ? { ...p, ...msg.payload } : p);
        setPlayers(updated);
        if (s.isHost) {
          broadcast({ 
            type: 'STATE_UPDATE', 
            payload: { players: updated, targetBpm: s.targetBpm, status: s.status, roundStatus: s.roundStatus, roundDuration: s.roundDuration, timer: s.timer },
            senderId: s.peerId 
          });
        }
        break;

      case 'TAP_EVENT':
        setPlayers(prev => prev.map(p => p.id === msg.senderId ? { ...p, lastTap: Date.now() } : p));
        break;
    }
  }, [broadcast]);

  const handleMessageRef = useRef(handleMessage);
  useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

  const setupConnection = (conn: any) => {
    if (connectionsRef.current.has(conn.peer)) return;
    
    console.log("[DEBUG] Configurando canal de datos para:", conn.peer);
    connectionsRef.current.set(conn.peer, conn);

    conn.on('data', (data: any) => {
      console.log("[DEBUG] Raw data received from", conn.peer, ":", data);
      handleMessageRef.current(data);
    });

    conn.on('close', () => {
      console.log("[DEBUG] Conexión cerrada:", conn.peer);
      connectionsRef.current.delete(conn.peer);
      setPendingPlayers(prev => prev.filter(p => p.id !== conn.peer));
      const filtered = playersRef.current.filter(p => p.id !== conn.peer);
      setPlayers(filtered);
      
      const s = stateRef.current;
      if (s.isHost) {
        broadcast({ 
          type: 'STATE_UPDATE', 
          payload: { players: filtered, targetBpm: s.targetBpm, status: s.status, roundStatus: s.roundStatus, roundDuration: s.roundDuration, timer: s.timer }, 
          senderId: s.peerId 
        });
      }
    });

    conn.on('open', () => {
      console.log("[DEBUG] Conexión confirmada como OPEN con:", conn.peer);
    });

    conn.on('error', (err: any) => console.error("[DEBUG] Error en conexión con", conn.peer, ":", err));
  };

  const setupPeer = (id: string) => {
    if (peerRef.current) peerRef.current.destroy();
    
    console.log("[DEBUG] Iniciando Peer:", id);
    const p = new Peer(id, { debug: 2 });
    peerRef.current = p;
    
    p.on('open', (newId: string) => {
      console.log("[DEBUG] Peer listo. ID:", newId);
      setPeerId(newId);
    });

    p.on('connection', (conn: any) => {
      console.log("[DEBUG] Intento de conexión entrante de:", conn.peer);
      // REGISTRAR INMEDIATAMENTE - No esperar al evento 'open'
      setupConnection(conn);
    });

    p.on('error', (err: any) => {
      console.error("[DEBUG] Error PeerJS:", err.type);
      if (err.type === 'peer-unavailable') setJoinError("La sala no existe.");
      if (err.type === 'unavailable-id') setJoinError("ID ocupado. Intenta de nuevo.");
    });

    return p;
  };

  const createGame = (nick: string) => {
    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(true);
    const rawId = Math.random().toString(36).substring(2, 8).toLowerCase();
    const hostId = `bpm-${rawId}`;
    setRoomId(hostId);
    setupPeer(hostId);
    setPlayers([{ id: hostId, nickname: nick, bpm: 0, accuracy: 0, lastTap: 0, isHost: true, totalScore: 0, roundScore: 0 }]);
    setStatus('ROOM');
    window.location.hash = hostId;
  };

  const joinGame = (nick: string, targetRoomId: string) => {
    let normalized = targetRoomId.trim().toLowerCase();
    if (!normalized.startsWith('bpm-')) normalized = 'bpm-' + normalized;

    console.log("[DEBUG] Intentando unir a:", normalized);
    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(false);
    setRoomId(normalized);
    setJoinError('Conectando...');

    const myId = `bpm-client-${Math.random().toString(36).substring(2, 8)}`;
    const p = setupPeer(myId);

    p.on('open', (id: string) => {
      const conn = p.connect(normalized, { reliable: true });
      setupConnection(conn);
      
      const onConnected = () => {
        console.log("[DEBUG] Enviando petición JOIN_REQUEST");
        conn.send({ type: 'PLAYER_JOIN_REQUEST', payload: { nickname: nick }, senderId: id });
        setJoinError('Solicitando entrada...');
      };

      if (conn.open) onConnected();
      else conn.on('open', onConnected);
    });
  };

  const acceptPlayer = (requestId: string) => {
    const pending = pendingPlayers.find(p => p.id === requestId);
    if (!pending) return;

    const newPlayer: Player = {
      id: pending.id, nickname: pending.nickname, bpm: 0, accuracy: 0, lastTap: 0, isHost: false, totalScore: 0, roundScore: 0
    };

    const updatedPlayers = [...playersRef.current, newPlayer];
    setPlayers(updatedPlayers);
    setPendingPlayers(prev => prev.filter(p => p.id !== requestId));

    const conn = connectionsRef.current.get(requestId);
    if (conn) {
      conn.send({ type: 'PLAYER_JOIN_RESPONSE', payload: { accepted: true }, senderId: peerId });
    }

    const s = stateRef.current;
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: updatedPlayers, targetBpm: s.targetBpm, status: s.status, roundStatus: s.roundStatus, roundDuration: s.roundDuration, timer: s.timer },
      senderId: s.peerId 
    });
  };

  const rejectPlayer = (requestId: string) => {
    const conn = connectionsRef.current.get(requestId);
    if (conn) {
      conn.send({ type: 'PLAYER_JOIN_RESPONSE', payload: { accepted: false, message: 'El host ha rechazado tu entrada.' }, senderId: peerId });
      setTimeout(() => conn.close(), 500);
    }
    setPendingPlayers(prev => prev.filter(p => p.id !== requestId));
  };

  const leaveGame = () => {
    if (peerRef.current) peerRef.current.destroy();
    peerRef.current = null;
    connectionsRef.current.clear();
    setPeerId('');
    setRoomId('');
    setStatus('LOBBY');
    setPlayers([]);
    setPendingPlayers([]);
    setIsHost(false);
    setJoinError(null);
    window.location.hash = '';
  };

  const startGameSession = () => {
    if (!isHost) return;
    setStatus('PLAYING');
    setRoundStatus('CONFIG');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'CONFIG', roundDuration, timer: 0 },
      senderId: peerId 
    });
  };

  const startRound = (duration: number, target: number) => {
    if (!isHost) return;
    setTargetBpm(target);
    setRoundDuration(duration);
    setTimer(duration);
    const resetPlayers = playersRef.current.map(p => ({ ...p, bpm: 0, roundScore: 0 }));
    setPlayers(resetPlayers);
    setRoundStatus('ACTIVE');
    
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: resetPlayers, targetBpm: target, status: 'PLAYING', roundStatus: 'ACTIVE', roundDuration: duration, timer: duration },
      senderId: peerId 
    });

    const interval = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          endRound();
          return 0;
        }
        const nextTime = prev - 1;
        broadcast({ 
          type: 'STATE_UPDATE', 
          payload: { players: playersRef.current, targetBpm: target, status: 'PLAYING', roundStatus: 'ACTIVE', roundDuration: duration, timer: nextTime },
          senderId: peerId 
        });
        return nextTime;
      });
    }, 1000);
  };

  const endRound = () => {
    setRoundStatus('RESULTS_BPM');
    broadcast({ type: 'STATE_UPDATE', payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'RESULTS_BPM', roundDuration, timer: 0 }, senderId: peerId });
  };

  const showScores = () => {
    const scoredPlayers = playersRef.current.map(p => {
      const diff = Math.abs(p.bpm - targetBpm);
      let points = 0;
      if (diff === 0) points = 3;
      else if (diff <= 1) points = 2;
      else if (diff <= 2) points = 1;
      return { ...p, roundScore: points, totalScore: p.totalScore + points };
    });
    setPlayers(scoredPlayers);
    setRoundStatus('RESULTS_SCORES');
    broadcast({ type: 'STATE_UPDATE', payload: { players: scoredPlayers, targetBpm, status: 'PLAYING', roundStatus: 'RESULTS_SCORES', roundDuration, timer: 0 }, senderId: peerId });
  };

  const showFinalStandings = () => {
    setRoundStatus('FINAL');
    broadcast({ type: 'STATE_UPDATE', payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'FINAL', roundDuration, timer: 0 }, senderId: peerId });
  };

  const nextRoundConfig = () => {
    setRoundStatus('CONFIG');
    broadcast({ type: 'STATE_UPDATE', payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'CONFIG', roundDuration, timer: 0 }, senderId: peerId });
  };

  const updateMyStats = (bpm: number) => {
    const s = stateRef.current;
    if (s.isHost) {
      const updated = playersRef.current.map(p => p.id === s.peerId ? { ...p, bpm } : p);
      setPlayers(updated);
      broadcast({ type: 'STATE_UPDATE', payload: { players: updated, targetBpm: s.targetBpm, status: s.status, roundStatus: s.roundStatus, roundDuration: s.roundDuration, timer: s.timer }, senderId: s.peerId });
    } else {
      const hostConn = connectionsRef.current.get(s.roomId);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: 'PLAYER_STAT_UPDATE', payload: { bpm }, senderId: s.peerId });
      }
    }
  };

  const sendLocalTap = () => {
    setLastLocalTap(Date.now());
    const s = stateRef.current;
    if (!s.isHost) {
      const hostConn = connectionsRef.current.get(s.roomId);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: 'TAP_EVENT', payload: {}, senderId: s.peerId });
      }
    } else {
      broadcast({ type: 'TAP_EVENT', payload: {}, senderId: s.peerId });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {status === 'LOBBY' ? (
        <div className="flex flex-col items-center">
          <Lobby initialNickname={nickname} initialRoomId={roomId} onCreate={createGame} onJoin={joinGame} />
          {joinError && (
            <div className="mt-6 bg-white border border-slate-200 px-6 py-3 rounded-2xl shadow-sm animate-pulse">
              <p className="text-indigo-600 font-bold text-sm text-center">{joinError}</p>
            </div>
          )}
        </div>
      ) : (
        <GameRoom 
          peerId={peerId} roomId={roomId} isHost={isHost} players={players} status={status} 
          roundStatus={roundStatus} targetBpm={targetBpm} timer={timer}
          pendingPlayers={pendingPlayers} onAccept={acceptPlayer} onReject={rejectPlayer}
          onStartSession={startGameSession} onStartRound={startRound} onShowScores={showScores} 
          onShowFinal={showFinalStandings} onNextRound={nextRoundConfig} onStatUpdate={updateMyStats} 
          onTap={sendLocalTap} onLeave={leaveGame} lastLocalTap={lastLocalTap} nickname={nickname}
        />
      )}
    </div>
  );
};

export default App;
