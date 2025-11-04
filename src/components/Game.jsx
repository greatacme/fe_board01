import React, { useState, useEffect, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Board from './Board';
import Inventory from './Inventory';
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
  const [selectedInventoryPiece, setSelectedInventoryPiece] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [allPieces, setAllPieces] = useState([]); // All pieces including those in inventory

  const connect = useCallback(() => {
    const socket = new SockJS('http://localhost:8080/ws');
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
      const response = await fetch('http://localhost:8080/api/game/rooms', {
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
      console.log('=== Room Created ===');
      console.log('data.playerColor:', data.playerColor);
      setPlayerColor(data.playerColor);
      setMessage(`Simulation이 생성되었습니다! ID: ${data.roomId}`);

      // Load initial pieces for inventory
      await loadInitialPieces(data.roomId);

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
      const response = await fetch(`http://localhost:8080/api/game/rooms/${inputRoomId.trim()}/join`, {
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

      // Load initial pieces for inventory
      await loadInitialPieces(data.roomId);

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

  const loadInitialPieces = async (roomIdParam) => {
    console.log('=== loadInitialPieces 호출 ===');
    console.log('roomIdParam:', roomIdParam);
    console.log('playerId:', playerId);

    try {
      const url = `http://localhost:8080/api/game/rooms/${roomIdParam}/initial-pieces?playerId=${playerId}`;
      console.log('Fetching URL:', url);

      const response = await fetch(url);
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to load initial pieces');
      }
      const pieces = await response.json();
      console.log('Received pieces:', pieces);
      console.log('Number of pieces:', pieces.length);
      console.log('First piece:', pieces[0]);

      // Add inventoryIndex to each piece to preserve their position in inventory
      const piecesWithIndex = pieces.map((piece, index) => ({
        ...piece,
        inventoryIndex: index
      }));

      console.log('Setting allPieces with', piecesWithIndex.length, 'pieces');
      setAllPieces(piecesWithIndex);
    } catch (error) {
      console.error('초기 말 로드 실패:', error);
    }
  };

  // Sync allPieces with gameState when it updates
  useEffect(() => {
    if (gameState && gameState.pieces && gameState.pieces.length > 0) {
      console.log('=== Syncing allPieces with gameState ===');
      console.log('gameState.pieces.length:', gameState.pieces.length);
      console.log('gameState.status:', gameState.status);

      // Merge gameState.pieces with allPieces, preserving inventoryIndex
      setAllPieces(prev => {
        console.log('Previous allPieces.length:', prev.length);

        // Create a map of existing pieces with their inventoryIndex
        const prevMap = new Map(prev.map(p => [p.id, p]));

        // Update pieces from gameState, preserving inventoryIndex
        const updatedPieces = gameState.pieces.map(p => ({
          ...p,
          inventoryIndex: prevMap.get(p.id)?.inventoryIndex
        }));

        // Add pieces that are not in gameState yet (only during SETUP)
        if (gameState.status === 'SETUP') {
          const existingIds = new Set(gameState.pieces.map(p => p.id));
          const prevNotInGameState = prev.filter(p => !existingIds.has(p.id));
          console.log('Adding pieces not in gameState:', prevNotInGameState.length);
          return [...updatedPieces, ...prevNotInGameState];
        }

        return updatedPieces;
      });
    } else {
      console.log('=== Skipping allPieces sync (no pieces in gameState) ===');
    }
  }, [gameState]);

  const handleInventoryPieceSelect = (piece) => {
    // If clicking on the same piece again, deselect it
    if (selectedInventoryPiece && selectedInventoryPiece.id === piece.id) {
      setSelectedInventoryPiece(null);
      setMessage('선택 취소됨');
      return;
    }
    setSelectedInventoryPiece(piece);
    setMessage(`${piece.type.koreanName} 선택됨. 보드에 배치하세요.`);
  };

  const handleBoardClickForPlacement = async (x, y) => {
    if (!roomId) return;

    // Check if clicking on an already placed piece
    const clickedPiece = allPieces.find(
      p => p.position && p.position.x === x && p.position.y === y
    );

    // If a piece is already selected
    if (selectedInventoryPiece) {
      // If clicking on the selected piece again, deselect it
      if (clickedPiece && clickedPiece.id === selectedInventoryPiece.id) {
        setSelectedInventoryPiece(null);
        setMessage('선택 취소됨');
        return;
      }

      // If clicking on another piece, select that piece instead
      if (clickedPiece) {
        setSelectedInventoryPiece(clickedPiece);
        setMessage(`${clickedPiece.type.koreanName} 선택됨. 다른 위치로 이동하거나 더블클릭하여 인벤토리로 되돌리세요.`);
        return;
      }

      // Otherwise, try to place/move the piece
      await placePiece(selectedInventoryPiece, x, y);
    } else {
      // No piece selected, check if clicking on a piece to select it
      if (clickedPiece) {
        setSelectedInventoryPiece(clickedPiece);
        setMessage(`${clickedPiece.type.koreanName} 선택됨. 다른 위치로 이동하거나 더블클릭하여 인벤토리로 되돌리세요.`);
      }
    }
  };

  const placePiece = async (piece, x, y) => {
    // Validate placement position is in player's own camp (except front line)
    const isValidPosition = (playerColor === 'RED' && x >= 0 && x <= 4) ||
                           (playerColor === 'BLUE' && x >= 9 && x <= 13);

    if (!isValidPosition) {
      const campName = playerColor === 'RED' ? '왼쪽(RED) 진영 (x: 0-4)' : '오른쪽(BLUE) 진영 (x: 9-13)';
      setMessage(`자기 진영(${campName})에만 말을 배치할 수 있습니다. 최전방 1열은 제외됩니다.`);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/api/game/rooms/${roomId}/place-piece`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId,
          pieceId: piece.id,
          position: { x, y }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to place piece');
      }

      const data = await response.json();
      setGameState(data);

      // Update all pieces, preserving inventoryIndex
      setAllPieces(prev =>
        prev.map(p =>
          p.id === piece.id
            ? { ...p, position: { x, y }, inventoryIndex: p.inventoryIndex }
            : p
        )
      );

      setSelectedInventoryPiece(null);
      setMessage('말이 배치/이동되었습니다');
    } catch (error) {
      console.error('말 배치 실패:', error);
      setMessage('말 배치 실패: 자기 진영에만 배치 가능합니다');
    }
  };

  const handleInventoryClick = async (clickedPiece, clickedIndex) => {
    // If clicked on a piece in inventory, select it
    if (clickedPiece) {
      handleInventoryPieceSelect(clickedPiece);
      return;
    }

    // If clicked on empty area and a placed piece is selected, move it to that inventory position
    if (!clickedPiece && selectedInventoryPiece && selectedInventoryPiece.position) {
      console.log('Moving piece to inventory position:', clickedIndex);
      await moveToInventoryPosition(selectedInventoryPiece, clickedIndex);
    }
  };

  const moveToInventoryPosition = async (piece, targetIndex) => {
    console.log('=== moveToInventoryPosition 호출 ===');
    console.log('piece:', piece);
    console.log('targetIndex:', targetIndex);
    console.log('roomId:', roomId);
    console.log('playerId:', playerId);

    try {
      const requestBody = {
        playerId,
        pieceId: piece.id,
        position: null
      };

      console.log('Request body:', JSON.stringify(requestBody));

      const response = await fetch(`http://localhost:8080/api/game/rooms/${roomId}/place-piece`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to move piece to inventory: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Success response:', data);
      setGameState(data);

      // Update all pieces, changing inventoryIndex to target position
      setAllPieces(prev =>
        prev.map(p =>
          p.id === piece.id
            ? { ...p, position: null, inventoryIndex: targetIndex }
            : p
        )
      );

      setSelectedInventoryPiece(null);
      setMessage(`말이 인벤토리 위치 ${targetIndex}로 이동했습니다`);
    } catch (error) {
      console.error('말 인벤토리 이동 실패 - 전체 에러:', error);
      setMessage(`말 인벤토리 이동 실패: ${error.message}`);
    }
  };

  const handleRandomPlacement = async () => {
    if (!roomId || !playerColor) return;

    setMessage('무작위로 배치하는 중...');

    try {
      // Get all valid positions for player's camp (excluding front line)
      const validPositions = [];
      if (playerColor === 'RED') {
        // RED: x: 0-4, y: 0-6
        for (let x = 0; x <= 4; x++) {
          for (let y = 0; y <= 6; y++) {
            validPositions.push({ x, y });
          }
        }
      } else {
        // BLUE: x: 9-13, y: 0-6
        for (let x = 9; x <= 13; x++) {
          for (let y = 0; y <= 6; y++) {
            validPositions.push({ x, y });
          }
        }
      }

      // Get pieces in inventory (not yet placed)
      const piecesToPlace = allPieces.filter(p =>
        !p.position || p.position === null || p.position === undefined
      );

      console.log('Pieces to place:', piecesToPlace.length);
      console.log('Valid positions:', validPositions.length);

      if (piecesToPlace.length > validPositions.length) {
        setMessage('배치할 공간이 부족합니다');
        return;
      }

      // Shuffle positions using Fisher-Yates algorithm
      const shuffledPositions = [...validPositions];
      for (let i = shuffledPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
      }

      // Place each piece at a random position
      for (let i = 0; i < piecesToPlace.length; i++) {
        const piece = piecesToPlace[i];
        const position = shuffledPositions[i];

        const response = await fetch(`http://localhost:8080/api/game/rooms/${roomId}/place-piece`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerId,
            pieceId: piece.id,
            position: position
          })
        });

        if (!response.ok) {
          console.error(`Failed to place piece ${piece.id} at ${position.x},${position.y}`);
          continue;
        }

        const data = await response.json();
        setGameState(data);

        // Update local state
        setAllPieces(prev =>
          prev.map(p =>
            p.id === piece.id
              ? { ...p, position: position, inventoryIndex: p.inventoryIndex }
              : p
          )
        );
      }

      setMessage('무작위 배치 완료!');
    } catch (error) {
      console.error('무작위 배치 실패:', error);
      setMessage('무작위 배치 실패');
    }
  };

  const handleReady = async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`http://localhost:8080/api/game/rooms/${roomId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId })
      });

      if (!response.ok) {
        throw new Error('Failed to set ready');
      }

      const data = await response.json();
      setGameState(data);
      setIsReady(true);
      setMessage('준비 완료! 상대방을 기다리는 중...');
    } catch (error) {
      console.error('준비 완료 실패:', error);
      setMessage('준비 완료 실패');
    }
  };

  const getCurrentTurnText = () => {
    if (!gameState) return '대기 중...';
    if (gameState.status === 'WAITING') return '상대 플레이어를 기다리는 중...';
    if (gameState.status === 'SETUP') return '말 배치 중...';
    if (gameState.status === 'FINISHED') {
      return `Simulation 종료! 승자: ${gameState.winner}`;
    }
    return `현재 턴: ${gameState.currentTurn}`;
  };

  const isAllPiecesPlaced = () => {
    return allPieces.every(p => p.position !== null && p.position !== undefined);
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
      ) : gameState ? (
        gameState.status === 'SETUP' ? (
          <div className={`game-layout ${playerColor === 'BLUE' ? 'reverse-layout' : ''}`}>
            <Inventory
              pieces={allPieces}
              onInventoryClick={handleInventoryClick}
              playerColor={playerColor}
              selectedPiece={selectedInventoryPiece}
              isPlaying={false}
            />
            <div className="board-section">
              <Board
                pieces={allPieces}
                onPieceClick={handleBoardClickForPlacement}
                selectedPiece={selectedInventoryPiece}
                currentTurn={null}
                playerColor={playerColor}
              />
              <div className="ready-section">
                {!isReady && (
                  <>
                    <button
                      className="random-button"
                      onClick={handleRandomPlacement}
                    >
                      임의배치
                    </button>
                    <button
                      className="ready-button"
                      onClick={handleReady}
                      disabled={!isAllPiecesPlaced()}
                    >
                      준비 완료
                    </button>
                  </>
                )}
                {isReady && (
                  <div className="ready-status">
                    ✓ 준비 완료! 상대방을 기다리는 중...
                  </div>
                )}

                {/* Display both players' ready status */}
                {gameState && (
                  <div className="players-status">
                    <div className={`player-status ${playerColor === 'RED' ? 'me' : 'opponent'}`}>
                      <span className="player-label">RED 플레이어:</span>
                      <span className={`status-indicator ${gameState.redPlayerReady ? 'ready' : 'not-ready'}`}>
                        {gameState.redPlayerReady ? '✓ 준비 완료' : '대기 중'}
                      </span>
                    </div>
                    <div className={`player-status ${playerColor === 'BLUE' ? 'me' : 'opponent'}`}>
                      <span className="player-label">BLUE 플레이어:</span>
                      <span className={`status-indicator ${gameState.bluePlayerReady ? 'ready' : 'not-ready'}`}>
                        {gameState.bluePlayerReady ? '✓ 준비 완료' : '대기 중'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : gameState.status === 'PLAYING' && gameState.pieces ? (
          <div className={`game-layout ${playerColor === 'BLUE' ? 'reverse-layout' : ''}`}>
            <Inventory
              pieces={allPieces}
              onInventoryClick={() => {}} // No interaction during playing
              playerColor={playerColor}
              selectedPiece={null}
              isPlaying={true}
            />
            <Board
              pieces={gameState.pieces}
              onPieceClick={handlePieceClick}
              selectedPiece={selectedPiece}
              currentTurn={gameState.currentTurn}
              playerColor={playerColor}
            />
          </div>
        ) : (
          <div className="loading">Simulation 로딩 중...</div>
        )
      ) : (
        <div className="loading">Simulation 로딩 중...</div>
      )}
    </div>
  );
};

export default Game;
