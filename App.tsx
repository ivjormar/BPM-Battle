
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
  const [roomClosed, setRoomClosed] = useState(false);

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
    if (!msg || !msg.type) return;
    const s = stateRef.current;

    switch (msg.type) {
      case 'ROOM_CLOSED':
        setRoomClosed(true);
        break;

      case 'PLAYER_JOIN_REQUEST':
        setPendingPlayers(prev => {
          if (prev.find(p => p.id === msg.senderId) || playersRef.current.find(p => p.id === msg.senderId)) return prev;
          return [...prev, { id: msg.senderId, nickname: msg.payload.nickname }];
        });
        break;

      case 'PLAYER_JOIN_RESPONSE':
        if (msg.payload.accepted) {
          if (joinIntervalRef.current) clearInterval(joinIntervalRef.current);
          setStatus('ROOM');
          setJoinError(null);
          setRoomClosed(false);
        } else {
          setJoinError(msg.payload.message || 'Entrada denegada');
          if (joinIntervalRef.current) clearInterval(joinIntervalRef.current);
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
            payload: { 
              players: updated, 
              targetBpm: s.targetBpm, 
              status: s.status, 
              roundStatus: s.roundStatus, 
              roundDuration: s.roundDuration, 
              timer: s.timer 
            },
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
    conn.on('data', (data: any) => {
      handleMessageRef.current(data);
    });

    conn.on('open', () => {
      connectionsRef.current.set(conn.peer, conn);
      if (stateRef.current.isHost) {
        const s = stateRef.current;
        conn.send({ 
          type: 'STATE_UPDATE', 
          payload: { 
            players: playersRef.current, 
            targetBpm: s.targetBpm, 
            status: s.status, 
            roundStatus: s.roundStatus, 
            roundDuration: s.roundDuration, 
            timer: s.timer 
          }, 
          senderId: s.peerId 
        });
      }
    });

    conn.on('close', () => {
      connectionsRef.current.delete(conn.peer);
      if (!stateRef.current.isHost && conn.peer === stateRef.current.roomId) {
        setRoomClosed(true);
      }
      setPendingPlayers(prev => prev.filter(p => p.id !== conn.peer));
      setPlayers(prev => prev.filter(p => p.id !== conn.peer));
    });

    conn.on('error', (err: any) => {
      console.error("Error en conexión:", err);
      if (!stateRef.current.isHost) {
        setJoinError("Error de conexión con el Host. Reintentando...");
      }
    });
  };

  const setupPeer = (id: string) => {
    if (peerRef.current) peerRef.current.destroy();
    
    const p = new Peer(id, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          { urls: 'stun:stun.xten.com' }
        ],
        iceCandidatePoolSize: 10
      }
    });
    
    peerRef.current = p;
    p.on('open', (newId: string) => setPeerId(newId));
    p.on('connection', (conn: any) => setupConnection(conn));
    p.on('error', (err: any) => {
      console.error("Peer Error:", err.type);
      if (err.type === 'peer-unavailable') {
        setJoinError("La sala no existe o el Host no es alcanzable en esta red.");
      }
      if (err.type === 'network') {
        setJoinError("Error de red. Verifica tu conexión.");
      }
    });
    return p;
  };

  const createGame = (nick: string) => {
    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(true);
    setRoomClosed(false);
    const hostId = `bpm-${Math.random().toString(36).substring(2, 8)}`;
    setRoomId(hostId);
    setupPeer(hostId);
    setPlayers([{ id: hostId, nickname: nick, bpm: 0, accuracy: 0, lastTap: 0, isHost: true, totalScore: 0, roundScore: 0 }]);
    setStatus('ROOM');
    window.location.hash = hostId;
  };

  const joinGame = (nick: string, targetRoomId: string) => {
    let normalized = targetRoomId.trim().toLowerCase();
    if (normalized.includes('#')) normalized = normalized.split('#').pop() || '';
    if (!normalized.startsWith('bpm-')) normalized = 'bpm-' + normalized;

    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(false);
    setRoomClosed(false);
    setRoomId(normalized);
    setJoinError('Iniciando conexión...');

    const p = setupPeer(`client-${Math.random().toString(36).substring(2, 6)}`);

    p.on('open', (myId: string) => {
      setJoinError('Buscando al anfitrión...');
      const conn = p.connect(normalized, { 
        reliable: true,
        metadata: { nickname: nick }
      });
      setupConnection(conn);
      
      const interval = window.setInterval(() => {
        if (conn.open) {
          conn.send({ type: 'PLAYER_JOIN_REQUEST', payload: { nickname: nick }, senderId: myId });
          setJoinError('Solicitud enviada. Esperando al Host...');
        } else {
          setJoinError('Estableciendo túnel P2P seguro...');
        }
      }, 2000);
      joinIntervalRef.current = interval;
    });
  };

  const acceptPlayer = (requestId: string) => {
    const pending = pendingPlayers.find(p => p.id === requestId);
    if (!pending) return;

    const newPlayer: Player = {
      id: requestId, nickname: pending.nickname, bpm: 0, accuracy: 0, lastTap: 0, isHost: false, totalScore: 0, roundScore: 0
    };

    setPlayers(prev => {
      const updated = [...prev, newPlayer];
      const conn = connectionsRef.current.get(requestId);
      if (conn) {
        conn.send({ type: 'PLAYER_JOIN_RESPONSE', payload: { accepted: true }, senderId: peerId });
      }
      const s = stateRef.current;
      broadcast({ 
        type: 'STATE_UPDATE', 
        payload: { players: updated, targetBpm: s.targetBpm, status: s.status, roundStatus: s.roundStatus, roundDuration: s.roundDuration, timer: s.timer },
        senderId: peerId 
      });
      return updated;
    });
    setPendingPlayers(prev => prev.filter(p => p.id !== requestId));
  };

  const rejectPlayer = (requestId: string) => {
    const conn = connectionsRef.current.get(requestId);
    if (conn) conn.send({ type: 'PLAYER_JOIN_RESPONSE', payload: { accepted: false, message: 'Rechazado por el host.' }, senderId: peerId });
    setPendingPlayers(prev => prev.filter(p => p.id !== requestId));
  };

  const joinIntervalRef = useRef<number | null>(null);

  const leaveGame = () => {
    if (stateRef.current.isHost) {
      broadcast({ type: 'ROOM_CLOSED', payload: {}, senderId: peerId });
    }
    if (joinIntervalRef.current) clearInterval(joinIntervalRef.current);
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
    setRoomClosed(false);
    window.location.hash = '';
  };

  const startGameSession = () => {
    if (!isHost) return;
    setStatus('PLAYING');
    setRoundStatus('CONFIG');
    const s = stateRef.current;
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { 
        players: playersRef.current, 
        targetBpm: s.targetBpm, 
        status: 'PLAYING', 
        roundStatus: 'CONFIG', 
        roundDuration: s.roundDuration, 
        timer: 0 
      },
      senderId: s.peerId 
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
      payload: { 
        players: resetPlayers, 
        targetBpm: target, 
        status: 'PLAYING', 
        roundStatus: 'ACTIVE', 
        roundDuration: duration, 
        timer: duration 
      },
      senderId: stateRef.current.peerId 
    });

    const interval = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          endRound();
          return 0;
        }
        const nextTime = prev - 1;
        const cur = stateRef.current;
        broadcast({ 
          type: 'STATE_UPDATE', 
          payload: { 
            players: playersRef.current, 
            targetBpm: cur.targetBpm, 
            status: 'PLAYING', 
            roundStatus: 'ACTIVE', 
            roundDuration: cur.roundDuration, 
            timer: nextTime 
          },
          senderId: cur.peerId 
        });
        return nextTime;
      });
    }, 1000);
  };

  const endRound = () => {
    const s = stateRef.current;
    setRoundStatus('RESULTS_BPM');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { 
        players: playersRef.current, 
        targetBpm: s.targetBpm, 
        status: 'PLAYING', 
        roundStatus: 'RESULTS_BPM', 
        roundDuration: s.roundDuration, 
        timer: 0 
      }, 
      senderId: s.peerId 
    });
  };

  const showScores = () => {
    const s = stateRef.current;
    const scoredPlayers = playersRef.current.map(p => {
      if (p.isHost) return { ...p, roundScore: 0 };
      const diff = Math.abs(p.bpm - s.targetBpm);
      let points = 0;
      if (diff === 0) points = 3;
      else if (diff <= 1) points = 2;
      else if (diff <= 2) points = 1;
      return { ...p, roundScore: points, totalScore: p.totalScore + points };
    });
    setPlayers(scoredPlayers);
    setRoundStatus('RESULTS_SCORES');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { 
        players: scoredPlayers, 
        targetBpm: s.targetBpm, 
        status: 'PLAYING', 
        roundStatus: 'RESULTS_SCORES', 
        roundDuration: s.roundDuration, 
        timer: 0 
      }, 
      senderId: s.peerId 
    });
  };

  const showFinalStandings = () => {
    const s = stateRef.current;
    setRoundStatus('FINAL');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { 
        players: playersRef.current, 
        targetBpm: s.targetBpm, 
        status: 'PLAYING', 
        roundStatus: 'FINAL', 
        roundDuration: s.roundDuration, 
        timer: 0 
      }, 
      senderId: s.peerId 
    });
  };

  const nextRoundConfig = () => {
    const s = stateRef.current;
    setRoundStatus('CONFIG');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { 
        players: playersRef.current, 
        targetBpm: s.targetBpm, 
        status: 'PLAYING', 
        roundStatus: 'CONFIG', 
        roundDuration: s.roundDuration, 
        timer: 0 
      }, 
      senderId: s.peerId 
    });
  };

  const updateMyStats = (bpm: number) => {
    const s = stateRef.current;
    if (s.isHost) return; 

    const hostConn = connectionsRef.current.get(s.roomId);
    if (hostConn && hostConn.open) {
      hostConn.send({ type: 'PLAYER_STAT_UPDATE', payload: { bpm }, senderId: s.peerId });
    }
  };

  const sendLocalTap = () => {
    setLastLocalTap(Date.now());
    const s = stateRef.current;
    if (s.isHost) {
      broadcast({ type: 'TAP_EVENT', payload: {}, senderId: s.peerId });
    } else {
      const hostConn = connectionsRef.current.get(s.roomId);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: 'TAP_EVENT', payload: {}, senderId: s.peerId });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {status === 'LOBBY' ? (
        <div className="flex flex-col items-center w-full">
          <Lobby initialNickname={nickname} initialRoomId={roomId} onCreate={createGame} onJoin={joinGame} />
          {joinError && (
            <div className="mt-6 bg-white border border-indigo-100 px-8 py-4 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <p className="text-indigo-600 font-bold text-sm text-center">{joinError}</p>
              </div>
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
          roomClosed={roomClosed}
        />
      )}
    </div>
  );
};

export default App;
