import React, { useState, useEffect, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Board from './Board';
import './Game.css';

const Game = () => {
  const [stompClient, setStompClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerId] = useState(() => 'player-' + Math.random().toString(36).substr(2, 9));
  const [roomId, setRoomId] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [message, setMessage] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [mode, setMode] = useState(null); // 'create' or 'join'
  const [inputRoomId, setInputRoomId] = useState('');

  const connect = useCallback(() => {
    const socket = new SockJS('http://localhost:7184/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        console.log('WebSocket에 연결됨');
        setConnected(true);
        setStompClient(client);
        setMessage('서버에 연결되었습니다');
      },
      onStompError: (frame) => {
        console.error('STOMP 오류:', frame);
        setMessage('연결 오류가 발생했습니다');
      },
      onWebSocketError: (error) => {
        console.error('WebSocket 오류:', error);
        setMessage('WebSocket 오류가 발생했습니다');
      }
    });

    client.activate();
  }, [playerId]);

  useEffect(() => {
    connect();
    return () => {
      if (stompClient) {
        stompClient.deactivate();
      }
    };
  }, [connect]);

  useEffect(() => {
    if (stompClient && connected && stompClient.connected) {
      // Subscribe to personal queue for initial join response
      const personalSub = stompClient.subscribe(`/user/queue/reply`, (message) => {
        const state = JSON.parse(message.body);
        console.log('개인 응답 수신:', state);
        setGameState(state);
        if (state.roomId && !roomId) {
          setRoomId(state.roomId);
        }
        if (state.message) {
          setMessage(state.message);
        }

        // Determine player color
        if (!playerColor && state.pieces && state.pieces.length > 0) {
          setPlayerColor(state.currentTurn);
        }
      });

      return () => {
        personalSub.unsubscribe();
      };
    }
  }, [stompClient, connected, playerColor, roomId]);

  useEffect(() => {
    if (stompClient && connected && stompClient.connected && roomId) {
      const subscription = stompClient.subscribe(`/topic/game.${roomId}`, (message) => {
        const state = JSON.parse(message.body);
        console.log('시뮬레이션 상태 업데이트:', state);
        setGameState(state);
        if (state.message) {
          setMessage(state.message);
        }

        // Determine player color
        if (!playerColor && state.pieces && state.pieces.length > 0) {
          setPlayerColor(state.currentTurn);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [stompClient, connected, roomId, playerColor]);

  useEffect(() => {
    if (gameState && gameState.roomId && !roomId) {
      setRoomId(gameState.roomId);
      console.log('방에 참가:', gameState.roomId);
    }
  }, [gameState, roomId]);

  const handlePieceClick = (x, y) => {
    if (!gameState || !roomId || !connected || !stompClient || !stompClient.connected) return;

    const clickedPiece = gameState.pieces.find(
      p => !p.captured && p.position.x === x && p.position.y === y
    );

    if (selectedPiece) {
      // Try to move
      const moveRequest = {
        roomId,
        playerId,
        from: selectedPiece.position,
        to: { x, y }
      };

      console.log('이동 전송:', moveRequest);
      stompClient.publish({
        destination: '/app/game.move',
        body: JSON.stringify(moveRequest)
      });

      setSelectedPiece(null);
    } else if (clickedPiece && clickedPiece.color === gameState.currentTurn) {
      // Select piece
      setSelectedPiece(clickedPiece);
    }
  };

  const handleCreateRoom = async () => {
    if (!connected || !stompClient || !stompClient.connected) {
      setMessage('서버에 연결되지 않았습니다. 백엔드를 실행하세요.');
      return;
    }

    setGameStarted(true);
    setMessage('Simulation을 생성하는 중...');

    try {
      const response = await fetch('http://localhost:7184/api/game/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId })
      });

      if (!response.ok) {
        throw new Error('서버 오류로 Simulation을 생성할 수 없습니다');
      }

      const data = await response.json();
      console.log('방 생성 성공:', data);

      if (!data.roomId) {
        throw new Error('잘못된 응답입니다');
      }

      setRoomId(data.roomId);
      setGameState(data);
      setPlayerColor(data.playerColor);
      setMessage(`Simulation이 생성되었습니다! ID: ${data.roomId}`);

      // Notify via WebSocket
      stompClient.publish({
        destination: '/app/game.join',
        body: JSON.stringify({ playerId, roomId: data.roomId })
      });
    } catch (error) {
      console.error('방 생성 실패:', error);
      setMessage(`Simulation 생성 실패: ${error.message}`);
      setGameStarted(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!connected || !stompClient || !stompClient.connected) {
      setMessage('서버에 연결되지 않았습니다. 백엔드를 실행하세요.');
      return;
    }

    if (!inputRoomId.trim()) {
      setMessage('Simulation ID를 입력하세요');
      return;
    }

    setGameStarted(true);
    setMessage('Simulation에 참가하는 중...');

    try {
      const response = await fetch(`http://localhost:7184/api/game/rooms/${inputRoomId.trim()}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.message || 'Simulation을 찾을 수 없거나 이미 가득 찼습니다';
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('방 참가 성공:', data);

      if (!data.roomId) {
        throw new Error('잘못된 응답입니다');
      }

      setRoomId(data.roomId);
      setGameState(data);
      setPlayerColor(data.playerColor);
      setMessage(data.message || 'Simulation에 참가했습니다');

      // Notify via WebSocket
      stompClient.publish({
        destination: '/app/game.join',
        body: JSON.stringify({ playerId, roomId: data.roomId })
      });
    } catch (error) {
      console.error('방 참가 실패:', error);
      setMessage(`Simulation 참가 실패: ${error.message}`);
      setGameStarted(false);
    }
  };

  const getCurrentTurnText = () => {
    if (!gameState) return '대기 중...';
    if (gameState.status === 'WAITING') return '상대 플레이어를 기다리는 중...';
    if (gameState.status === 'FINISHED') {
      return `Simulation 종료! 승자: ${gameState.winner}`;
    }
    return `현재 턴: ${gameState.currentTurn}`;
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Simulation</h1>
        <p className="subtitle">실시간 멀티플레이어 통신</p>
        <div className="game-info">
          <p>접속 ID: {playerId}</p>
          {roomId && <p>Simulation ID: {roomId}</p>}
          <p className="turn-info">{getCurrentTurnText()}</p>
          {playerColor && <p>내 색상: {playerColor}</p>}
          {message && <p className="message">{message}</p>}
        </div>
      </div>

      {!gameStarted ? (
        <div className="start-screen">
          {!mode ? (
            <div className="mode-selection">
              <h2>Simulation 시작</h2>
              <button
                className="mode-button create-button"
                onClick={() => setMode('create')}
                disabled={!connected}
              >
                새 Simulation 생성
              </button>
              <button
                className="mode-button join-button"
                onClick={() => setMode('join')}
                disabled={!connected}
              >
                Simulation 참가
              </button>
              {!connected && <p className="warning">서버 연결 중...</p>}
            </div>
          ) : mode === 'create' ? (
            <div className="create-room">
              <h2>새 Simulation 생성</h2>
              <p>새로운 시뮬레이션을 생성합니다</p>
              <button
                className="start-button"
                onClick={handleCreateRoom}
              >
                생성
              </button>
              <button
                className="back-button"
                onClick={() => setMode(null)}
              >
                뒤로
              </button>
            </div>
          ) : (
            <div className="join-room">
              <h2>Simulation 참가</h2>
              <input
                type="text"
                className="room-id-input"
                placeholder="Simulation ID 입력"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <button
                className="start-button"
                onClick={handleJoinRoom}
              >
                참가
              </button>
              <button
                className="back-button"
                onClick={() => setMode(null)}
              >
                뒤로
              </button>
            </div>
          )}
        </div>
      ) : gameState && gameState.pieces ? (
        <Board
          pieces={gameState.pieces}
          onPieceClick={handlePieceClick}
          selectedPiece={selectedPiece}
          currentTurn={gameState.currentTurn}
          playerColor={playerColor}
        />
      ) : (
        <div className="loading">Simulation 로딩 중...</div>
      )}
    </div>
  );
};

export default Game;
