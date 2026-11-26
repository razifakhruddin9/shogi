import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  Lightbulb,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { parseSfen, positionRepetitionKey, toSfen } from '../engine/sfen';
import {
  applyMove,
  findKing,
  findLegalMoveByUsi,
  generateLegalMoves,
  getMaterialBalance,
  isInCheck,
  opponentOf,
} from '../engine/shogi';
import {
  BasePieceType,
  EngineEvaluation,
  GameResult,
  HAND_ORDER,
  INITIAL_SFEN,
  PieceType,
  ShogiMove,
  ShogiPosition,
  Side,
  Square,
} from '../engine/types';
import {
  CATEGORY_MAP,
  classifySinglePly,
  FullGameReview,
  generateFullGameReview,
  ReviewedPly,
} from '../engine/gameReview';
import {
  analyzeWithYaneuraOu,
  UsiAnalysisResult,
} from '../engine/usiClient';
import { GameReviewPanel } from './GameReviewPanel';
import { PlayConfig } from './Modals';
import { PlayerProfile } from './ShellChrome';
import { ShogiPieceSvg } from './ShogiPieceSvg';

export interface ArenaTabState {
  tabId: string;
  mode: 'play' | 'analysis';
  title: string;
  playConfig?: PlayConfig;
  initialSfen?: string;
  preloadMovesUsi?: string[];
}

interface ShogiBoardArenaProps {
  tabState: ArenaTabState;
  profile: PlayerProfile;
  usiReady: boolean;
  boardTheme: 'kaya' | 'walnut';
  showEnglishHints: boolean;
  notationMode: 'kifu' | 'western';
  onGameFinished?: (record: {
    title: string;
    senteName: string;
    senteElo: number;
    goteName: string;
    goteElo: number;
    result: '1-0' | '0-1' | '½-½';
    timeControl: string;
    movesUsi: string[];
    initialSfen: string;
  }) => void;
}

const FILES = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
const RANKS_JP = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const RANKS_EN = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function evalToSenteBarPercent(evalData: EngineEvaluation | null): number {
  if (!evalData) return 50;
  if (evalData.mateIn !== undefined) {
    return evalData.mateIn > 0 ? 96 : 4;
  }
  const clamped = Math.max(-1500, Math.min(1500, evalData.scoreCp));
  // Smooth sigmoid-like mapping
  return 50 + (clamped / 1500) * 44;
}

function formatEvalBarText(evalData: EngineEvaluation | null): string {
  if (!evalData) return '0.0';
  if (evalData.mateIn !== undefined) {
    const glyph = evalData.mateIn > 0 ? '▲' : '△';
    return `${glyph}M${Math.abs(evalData.mateIn)}`;
  }
  const pawns = evalData.scoreCp / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  const glyph = pawns > 0 ? '▲' : '△';
  const absP = Math.abs(pawns);
  return absP >= 10
    ? `${glyph}+${Math.round(absP)}`
    : `${glyph}+${absP.toFixed(1)}`;
}

function formatAdvantageSummary(evalData: EngineEvaluation | null): {
  text: string;
  tone: 'sente' | 'gote' | 'even';
} {
  if (!evalData) return { text: 'Seimbang (0.00)', tone: 'even' };
  if (evalData.mateIn !== undefined) {
    return evalData.mateIn > 0
      ? { text: `▲ Sente Skakmat M${evalData.mateIn}`, tone: 'sente' }
      : { text: `△ Gote Skakmat M${Math.abs(evalData.mateIn)}`, tone: 'gote' };
  }
  const pawns = evalData.scoreCp / 100;
  if (Math.abs(pawns) < 0.08) return { text: 'Seimbang (0.00)', tone: 'even' };
  return pawns > 0
    ? { text: `▲ Sente +${pawns.toFixed(2)}`, tone: 'sente' }
    : { text: `△ Gote +${Math.abs(pawns).toFixed(2)}`, tone: 'gote' };
}

export const ShogiBoardArena: React.FC<ShogiBoardArenaProps> = ({
  tabState,
  profile,
  usiReady,
  boardTheme,
  showEnglishHints,
  notationMode,
  onGameFinished,
}) => {
  const startSfen = tabState.initialSfen ?? INITIAL_SFEN;

  // Determine human side in Play mode
  const resolvedPlayerSide = useMemo<Side>(() => {
    if (tabState.mode === 'analysis') return 'b';
    const pref = tabState.playConfig?.playerSide ?? 'b';
    if (pref === 'random') return Math.random() < 0.5 ? 'b' : 'w';
    return pref;
  }, [tabState.mode, tabState.playConfig?.playerSide]);

  const [flipped, setFlipped] = useState<boolean>(
    tabState.mode === 'play' && resolvedPlayerSide === 'w',
  );

  // Build initial timeline from preloadMovesUsi if provided
  const initialTimeline = useMemo(() => {
    const positions: ShogiPosition[] = [parseSfen(startSfen)];
    const moves: ShogiMove[] = [];
    if (tabState.preloadMovesUsi?.length) {
      for (const usi of tabState.preloadMovesUsi) {
        const cur = positions[positions.length - 1];
        const legal = findLegalMoveByUsi(cur, usi);
        if (!legal) break;
        moves.push(legal);
        positions.push(applyMove(cur, legal));
      }
    }
    return { positions, moves };
  }, [startSfen, tabState.preloadMovesUsi]);

  const [positions, setPositions] = useState<ShogiPosition[]>(initialTimeline.positions);
  const [moves, setMoves] = useState<ShogiMove[]>(initialTimeline.moves);
  const [viewPly, setViewPly] = useState<number>(initialTimeline.moves.length);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [selectedHandPiece, setSelectedHandPiece] = useState<Exclude<BasePieceType, 'K'> | null>(
    null,
  );
  const [pendingPromotion, setPendingPromotion] = useState<{
    normal: ShogiMove;
    promoted: ShogiMove;
  } | null>(null);

  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'kifu' | 'review'>('kifu');
  const [showHintArrow, setShowHintArrow] = useState<boolean>(tabState.mode === 'analysis');
  const [evalData, setEvalData] = useState<EngineEvaluation | null>(null);
  const [evalByPly, setEvalByPly] = useState<
    Record<number, { scoreCp: number; mateIn?: number }>
  >({});
  const [usiDetails, setUsiDetails] = useState<UsiAnalysisResult | null>(null);
  const [gameReview, setGameReview] = useState<FullGameReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewProgress, setReviewProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [engineThinking, setEngineThinking] = useState<boolean>(false);
  const [copiedSfen, setCopiedSfen] = useState<boolean>(false);

  // Clocks
  const baseSeconds =
    tabState.mode === 'play' && tabState.playConfig && tabState.playConfig.timeMinutes > 0
      ? tabState.playConfig.timeMinutes * 60
      : 0;
  const incrementSec =
    tabState.mode === 'play' && tabState.playConfig ? tabState.playConfig.incrementSeconds : 0;

  const [clocks, setClocks] = useState<{ b: number; w: number }>({
    b: baseSeconds,
    w: baseSeconds,
  });

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<number>(0);
  const recordedResultRef = useRef<boolean>(false);

  const livePly = moves.length;
  const isViewingLive = viewPly === livePly;
  const displayPos = positions[viewPly] ?? positions[positions.length - 1];
  const livePos = positions[livePly];
  const lastMove = viewPly > 0 ? moves[viewPly - 1] : undefined;

  const isBotMatch =
    tabState.mode === 'play' && tabState.playConfig?.mode === 'bot';
  const botSide: Side | null = isBotMatch ? opponentOf(resolvedPlayerSide) : null;

  const legalMovesForDisplay = useMemo(
    () => (isViewingLive && !gameResult ? generateLegalMoves(displayPos) : []),
    [displayPos, isViewingLive, gameResult],
  );

  // Check game end status automatically when livePos changes
  useEffect(() => {
    if (tabState.mode !== 'play' || gameResult) return;

    const legal = generateLegalMoves(livePos);
    if (legal.length === 0) {
      const winner = opponentOf(livePos.turn);
      setGameResult({
        status: 'checkmate',
        winner,
        reason: `${winner === 'b' ? 'Sente (▲)' : 'Gote (△)'} wins by Checkmate`,
      });
      return;
    }

    // Sennichite (4-fold repetition)
    const currentKey = positionRepetitionKey(livePos);
    let count = 0;
    for (const p of positions) {
      if (positionRepetitionKey(p) === currentKey) count++;
    }
    if (count >= 4) {
      setGameResult({
        status: 'sennichite',
        winner: 'draw',
        reason: 'Draw by Repetition (Sennichite)',
      });
    }
  }, [livePos, positions, tabState.mode, gameResult]);

  // Save finished game to Recent Files once
  useEffect(() => {
    if (!gameResult || recordedResultRef.current || !onGameFinished) return;
    recordedResultRef.current = true;
    const tcLabel =
      baseSeconds > 0
        ? `${Math.floor(baseSeconds / 60)}+${incrementSec}`
        : 'Unlimited';
    const senteName =
      tabState.mode === 'play'
        ? isBotMatch
          ? resolvedPlayerSide === 'b'
            ? profile.username
            : tabState.playConfig!.botName
          : `${profile.username} (Sente)`
        : profile.username;
    const goteName =
      tabState.mode === 'play'
        ? isBotMatch
          ? resolvedPlayerSide === 'w'
            ? profile.username
            : tabState.playConfig!.botName
          : 'Player 2 (Gote)'
        : 'Analysis';

    const senteElo =
      isBotMatch && resolvedPlayerSide === 'w'
        ? tabState.playConfig!.botElo
        : profile.elo;
    const goteElo =
      isBotMatch && resolvedPlayerSide === 'w'
        ? profile.elo
        : isBotMatch
          ? tabState.playConfig!.botElo
          : profile.elo;

    const resStr: '1-0' | '0-1' | '½-½' =
      gameResult.winner === 'b'
        ? '1-0'
        : gameResult.winner === 'w'
          ? '0-1'
          : '½-½';

    onGameFinished({
      title: `${senteName} vs ${goteName} • ${tcLabel}`,
      senteName,
      senteElo,
      goteName,
      goteElo,
      result: resStr,
      timeControl: tcLabel,
      movesUsi: moves.map((m) => m.usi),
      initialSfen: startSfen,
    });
  }, [
    gameResult,
    onGameFinished,
    baseSeconds,
    incrementSec,
    tabState,
    isBotMatch,
    resolvedPlayerSide,
    profile,
    moves,
    startSfen,
  ]);

  // Timer tick
  useEffect(() => {
    if (tabState.mode !== 'play' || baseSeconds === 0 || gameResult) return;
    const interval = window.setInterval(() => {
      setClocks((prev) => {
        const turn = livePos.turn;
        const nextVal = prev[turn] - 1;
        if (nextVal <= 0) {
          const winner = opponentOf(turn);
          setGameResult({
            status: 'timeout',
            winner,
            reason: `${turn === 'b' ? 'Sente' : 'Gote'} flagged on time`,
          });
          return { ...prev, [turn]: 0 };
        }
        return { ...prev, [turn]: nextVal };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [tabState.mode, baseSeconds, gameResult, livePos.turn]);

  // Initialize Web Worker
  useEffect(() => {
    const worker = new Worker(new URL('../engine/engineWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const commitMove = useCallback(
    (move: ShogiMove) => {
      const mover = livePos.turn;
      const nextPos = applyMove(livePos, move);
      setPositions((prev) => [...prev, nextPos]);
      setMoves((prev) => [...prev, move]);
      setViewPly((prev) => prev + 1);
      setSelectedSquare(null);
      setSelectedHandPiece(null);
      setPendingPromotion(null);
      if (baseSeconds > 0 && incrementSec > 0) {
        setClocks((prev) => ({
          ...prev,
          [mover]: prev[mover] + incrementSec,
        }));
      }
    },
    [livePos, baseSeconds, incrementSec],
  );

  // Run YaneuraOu + Suisho5 (when online) or fallback Web Worker for Analysis / Bot Turn
  useEffect(() => {
    const shouldBotMove =
      tabState.mode === 'play' &&
      isBotMatch &&
      !gameResult &&
      livePos.turn === botSide;

    const shouldAnalyze =
      tabState.mode === 'analysis' || showHintArrow || shouldBotMove;

    if (!shouldAnalyze) return;

    const useYaneuraOu =
      usiReady &&
      (!shouldBotMove || tabState.playConfig?.engineKind === 'yaneuraou');

    const reqId = ++requestIdRef.current;
    let cancelled = false;
    setEngineThinking(true);

    if (useYaneuraOu) {
      const sfenStr = toSfen(displayPos);
      void analyzeWithYaneuraOu(displayPos, sfenStr, {
        movetimeMs: shouldBotMove ? 450 : 420,
        multiPv: tabState.mode === 'analysis' ? 3 : 1,
      }).then((usiRes) => {
        if (cancelled || reqId !== requestIdRef.current) return;
        if (usiRes) {
          setEngineThinking(false);
          setEvalData(usiRes);
          setEvalByPly((prev) => ({
            ...prev,
            [viewPly]: { scoreCp: usiRes.scoreCp, mateIn: usiRes.mateIn },
          }));
          setUsiDetails(usiRes);
          if (shouldBotMove && usiRes.bestMove) {
            const chosen = usiRes.bestMove;
            window.setTimeout(() => {
              commitMove(chosen);
            }, 180);
          }
          return;
        }
        // Fallback to browser worker if USI request failed
        runBrowserWorker();
      });

      return () => {
        cancelled = true;
      };
    }

    function runBrowserWorker() {
      const worker = workerRef.current;
      if (!worker) return;
      setUsiDetails(null);

      const botElo = tabState.playConfig?.botElo ?? 1600;
      const maxDepth =
        tabState.mode === 'analysis'
          ? 3
          : botElo <= 800
            ? 1
            : botElo <= 1300
              ? 2
              : 3;
      const timeLimitMs =
        tabState.mode === 'analysis' ? 650 : botElo >= 1800 ? 700 : 380;

      const handleMsg = (e: MessageEvent<{ id: number; result: EngineEvaluation }>) => {
        if (e.data.id !== reqId || cancelled) return;
        setEngineThinking(false);
        setEvalData(e.data.result);
        setEvalByPly((prev) => ({
          ...prev,
          [viewPly]: {
            scoreCp: e.data.result.scoreCp,
            mateIn: e.data.result.mateIn,
          },
        }));

        if (shouldBotMove && e.data.result.bestMove) {
          const chosen = e.data.result.bestMove;
          window.setTimeout(() => {
            commitMove(chosen);
          }, 220);
        }
      };

      worker.addEventListener('message', handleMsg);
      worker.postMessage({
        id: reqId,
        pos: displayPos,
        maxDepth,
        timeLimitMs,
        elo: shouldBotMove ? botElo : 1950,
      });
    }

    runBrowserWorker();

    return () => {
      cancelled = true;
    };
  }, [
    displayPos,
    livePos.turn,
    tabState.mode,
    tabState.playConfig?.botElo,
    tabState.playConfig?.engineKind,
    isBotMatch,
    botSide,
    gameResult,
    showHintArrow,
    usiReady,
    commitMove,
  ]);

  // Can human currently interact?
  const canInteract =
    isViewingLive &&
    !gameResult &&
    !pendingPromotion &&
    !(isBotMatch && livePos.turn === botSide);

  const legalTargetsForSelection = useMemo(() => {
    if (!canInteract) return new Map<string, ShogiMove[]>();
    const map = new Map<string, ShogiMove[]>();

    for (const m of legalMovesForDisplay) {
      if (selectedHandPiece) {
        if (m.drop && m.piece === selectedHandPiece) {
          const key = `${m.to.row}-${m.to.col}`;
          const arr = map.get(key) ?? [];
          arr.push(m);
          map.set(key, arr);
        }
      } else if (selectedSquare) {
        if (
          !m.drop &&
          m.from?.row === selectedSquare.row &&
          m.from?.col === selectedSquare.col
        ) {
          const key = `${m.to.row}-${m.to.col}`;
          const arr = map.get(key) ?? [];
          arr.push(m);
          map.set(key, arr);
        }
      }
    }
    return map;
  }, [canInteract, legalMovesForDisplay, selectedHandPiece, selectedSquare]);

  const handleSquareClick = (r: number, c: number) => {
    if (!canInteract) return;
    const key = `${r}-${c}`;
    const matchingMoves = legalTargetsForSelection.get(key);

    if (matchingMoves && matchingMoves.length > 0) {
      if (matchingMoves.length === 1) {
        commitMove(matchingMoves[0]);
      } else {
        const normal = matchingMoves.find((m) => !m.promote)!;
        const promoted = matchingMoves.find((m) => m.promote)!;
        setPendingPromotion({ normal, promoted });
      }
      return;
    }

    const clickedPiece = displayPos.board[r][c];
    if (clickedPiece && clickedPiece.side === displayPos.turn) {
      setSelectedHandPiece(null);
      if (selectedSquare?.row === r && selectedSquare?.col === c) {
        setSelectedSquare(null);
      } else {
        setSelectedSquare({ row: r, col: c });
      }
    } else {
      setSelectedSquare(null);
      setSelectedHandPiece(null);
    }
  };

  const handleHandPieceClick = (side: Side, piece: Exclude<BasePieceType, 'K'>) => {
    if (!canInteract || side !== displayPos.turn) return;
    if (displayPos.hands[side][piece] <= 0) return;
    setSelectedSquare(null);
    setSelectedHandPiece((prev) => (prev === piece ? null : piece));
  };

  const handleRematch = () => {
    setPositions([parseSfen(startSfen)]);
    setMoves([]);
    setViewPly(0);
    setGameResult(null);
    setGameReview(null);
    setEvalByPly({});
    setReviewProgress(null);
    setSidebarTab('kifu');
    setSelectedSquare(null);
    setSelectedHandPiece(null);
    setPendingPromotion(null);
    setClocks({ b: baseSeconds, w: baseSeconds });
    recordedResultRef.current = false;
  };

  const handleCopySfen = async () => {
    try {
      await navigator.clipboard.writeText(toSfen(displayPos));
      setCopiedSfen(true);
      window.setTimeout(() => setCopiedSfen(false), 1800);
    } catch {
      // ignore clipboard errors in restricted contexts
    }
  };

  const handleRunFullReview = useCallback(async () => {
    if (moves.length === 0 || reviewLoading) return;
    setReviewLoading(true);
    setSidebarTab('review');
    setReviewProgress({ done: 0, total: moves.length + 1 });

    const sElo =
      isBotMatch && resolvedPlayerSide === 'w'
        ? tabState.playConfig?.botElo ?? 1600
        : profile.elo;
    const gElo =
      isBotMatch && resolvedPlayerSide === 'b'
        ? tabState.playConfig?.botElo ?? 1600
        : profile.elo;

    const res = await generateFullGameReview({
      initialSfen: startSfen,
      moves,
      positions,
      usiReady,
      senteElo: sElo,
      goteElo: gElo,
      onProgress: (done, total) => setReviewProgress({ done, total }),
    });
    setGameReview(res);
    setEvalByPly((prev) => {
      const next = { ...prev };
      for (const p of res.plies) {
        next[p.ply] = { scoreCp: p.scoreCp, mateIn: p.mateIn };
      }
      return next;
    });
    setReviewLoading(false);
  }, [
    moves,
    positions,
    reviewLoading,
    startSfen,
    usiReady,
    isBotMatch,
    resolvedPlayerSide,
    tabState.playConfig?.botElo,
    profile.elo,
  ]);

  // Automatically generate Game Review when a match concludes
  const autoReviewedRef = useRef(false);
  useEffect(() => {
    if (!gameResult) {
      autoReviewedRef.current = false;
      return;
    }
    if (!autoReviewedRef.current && moves.length > 0) {
      autoReviewedRef.current = true;
      void handleRunFullReview();
    }
  }, [gameResult, moves.length, handleRunFullReview]);

  const reviewByPly = useMemo(() => {
    const map = new Map<number, ReviewedPly>();
    if (!gameReview) return map;
    for (const p of gameReview.plies) {
      map.set(p.ply, p);
    }
    return map;
  }, [gameReview]);

  // Show Chess.com-style move classification indicators ONLY in Analysis mode or post-game review
  const showAnalysisIndicators = tabState.mode === 'analysis' || Boolean(gameResult);

  const getPlyClassification = useCallback(
    (ply: number) => {
      if (!showAnalysisIndicators || ply <= 0) return null;
      const full = reviewByPly.get(ply);
      if (full) {
        return { category: full.category, cpLoss: full.cpLoss };
      }
      if (tabState.mode !== 'analysis') return null;
      const prevEval = evalByPly[ply - 1];
      const curEval = evalByPly[ply];
      const move = moves[ply - 1];
      const prevPos = positions[ply - 1];
      const curPos = positions[ply];
      if (!prevEval || !curEval || !move || !prevPos || !curPos) return null;
      return classifySinglePly({
        ply,
        mover: prevPos.turn,
        playedUsi: move.usi,
        prevScoreCp: prevEval.scoreCp,
        curScoreCp: curEval.scoreCp,
        prevMateIn: prevEval.mateIn,
        curMateIn: curEval.mateIn,
        prevPos,
        curPos,
        prefixMovesUsi: moves.slice(0, ply).map((m) => m.usi),
        initialSfen: startSfen,
      });
    },
    [
      evalByPly,
      moves,
      positions,
      reviewByPly,
      showAnalysisIndicators,
      startSfen,
      tabState.mode,
    ],
  );

  const activeMoveCls = useMemo(() => {
    const res = getPlyClassification(viewPly);
    if (!res) return null;
    return {
      ...res,
      meta: CATEGORY_MAP[res.category],
    };
  }, [getPlyClassification, viewPly]);

  // Visual coordinates & sides based on flip
  const topSide: Side = flipped ? 'b' : 'w';
  const bottomSide: Side = flipped ? 'w' : 'b';
  const material = getMaterialBalance(displayPos);
  const checkKingSide: Side | null = isInCheck(displayPos, displayPos.turn)
    ? displayPos.turn
    : null;
  const checkedKingSq = checkKingSide ? findKing(displayPos, checkKingSide) : null;

  const evalPercent = evalToSenteBarPercent(evalData);
  const topBarHeightPct = flipped ? evalPercent : 100 - evalPercent;
  const advSummary = formatAdvantageSummary(evalData);

  const getMoveImpact = useCallback(
    (ply: number): { deltaCp: number; text: string; tone: 'pos' | 'neg' | 'flat' } | null => {
      if (ply <= 0) return null;
      const prev = evalByPly[ply - 1];
      const cur = evalByPly[ply];
      if (!prev || !cur) return null;
      const mover: Side = positions[ply - 1]?.turn ?? 'b';
      const deltaCp = mover === 'b' ? cur.scoreCp - prev.scoreCp : prev.scoreCp - cur.scoreCp;
      const pawns = deltaCp / 100;
      if (Math.abs(pawns) < 0.05) {
        return { deltaCp, text: '0.0', tone: 'flat' };
      }
      return {
        deltaCp,
        text: `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`,
        tone: pawns > 0 ? 'pos' : 'neg',
      };
    },
    [evalByPly, positions],
  );

  const currentMoveImpact = useMemo(
    () => getMoveImpact(viewPly),
    [getMoveImpact, viewPly],
  );

  // Player display names
  const senteLabel =
    tabState.mode === 'analysis'
      ? 'Sente (▲)'
      : isBotMatch && resolvedPlayerSide === 'w'
        ? tabState.playConfig!.botName
        : profile.username;
  const senteEloLabel =
    tabState.mode === 'analysis'
      ? undefined
      : isBotMatch && resolvedPlayerSide === 'w'
        ? tabState.playConfig!.botElo
        : profile.elo;

  const goteLabel =
    tabState.mode === 'analysis'
      ? 'Gote (△)'
      : isBotMatch && resolvedPlayerSide === 'b'
        ? tabState.playConfig!.botName
        : isBotMatch
          ? profile.username
          : 'Player 2';
  const goteEloLabel =
    tabState.mode === 'analysis'
      ? undefined
      : isBotMatch && resolvedPlayerSide === 'b'
        ? tabState.playConfig!.botElo
        : isBotMatch
          ? profile.elo
          : undefined;

  const topName = topSide === 'b' ? senteLabel : goteLabel;
  const topElo = topSide === 'b' ? senteEloLabel : goteEloLabel;
  const bottomName = bottomSide === 'b' ? senteLabel : goteLabel;
  const bottomElo = bottomSide === 'b' ? senteEloLabel : goteEloLabel;

  const topMatLead =
    topSide === 'b'
      ? material.diff > 0
        ? `+${material.diff}`
        : null
      : material.diff < 0
        ? `+${Math.abs(material.diff)}`
        : null;
  const bottomMatLead =
    bottomSide === 'b'
      ? material.diff > 0
        ? `+${material.diff}`
        : null
      : material.diff < 0
        ? `+${Math.abs(material.diff)}`
        : null;

  // Arrow overlay coordinates (in 0..9 board space)
  const bestMoveArrow = useMemo(() => {
    if (!showHintArrow || !evalData?.bestMove || evalData.bestMove.drop) return null;
    const m = evalData.bestMove;
    if (!m.from) return null;
    const fromR = flipped ? 8 - m.from.row : m.from.row;
    const fromC = flipped ? 8 - m.from.col : m.from.col;
    const toR = flipped ? 8 - m.to.row : m.to.row;
    const toC = flipped ? 8 - m.to.col : m.to.col;
    return {
      x1: fromC * 100 + 50,
      y1: fromR * 100 + 50,
      x2: toC * 100 + 50,
      y2: toR * 100 + 50,
    };
  }, [showHintArrow, evalData, flipped]);

  // Move pairs for 2-column move list
  const moveRows = useMemo(() => {
    const rows: { num: number; sente?: ShogiMove; gote?: ShogiMove; sentePly: number; gotePly?: number }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      rows.push({
        num: Math.floor(i / 2) + 1,
        sente: moves[i],
        sentePly: i + 1,
        gote: moves[i + 1],
        gotePly: moves[i + 1] ? i + 2 : undefined,
      });
    }
    return rows;
  }, [moves]);

  const renderKomadai = (side: Side) => {
    const hand = displayPos.hands[side];
    const activeTurn = isViewingLive && !gameResult && displayPos.turn === side;
    return (
      <div className={`komadai-stand ${activeTurn ? 'active-turn' : ''}`}>
        <div className="komadai-label">
          {side === 'b' ? '▲ Sente Hand' : '△ Gote Hand'}
        </div>
        <div className="komadai-pieces">
          {HAND_ORDER.map((pType) => {
            const count = hand[pType];
            if (count === 0) return null;
            const isSelected = activeTurn && selectedHandPiece === pType;
            return (
              <button
                key={pType}
                type="button"
                className={`komadai-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleHandPieceClick(side, pType)}
                disabled={!canInteract || side !== displayPos.turn}
                title={`Drop ${pType} (x${count})`}
              >
                <div className="komadai-piece-icon">
                  <ShogiPieceSvg
                    type={pType}
                    side={side}
                    flipped={flipped}
                    showEnglishHint={showEnglishHints}
                    size="hand"
                  />
                </div>
                {count > 1 && <span className="komadai-count">{count}</span>}
              </button>
            );
          })}
          {HAND_ORDER.every((p) => hand[p] === 0) && (
            <span className="komadai-empty">Empty</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="arena-layout">
      {/* Left: Evaluation Bar + Board + Player Bars + Komadai */}
      <div className="arena-stage">
        <div className="arena-board-cluster">
          {/* Evaluation Bar */}
          <div
            className="eval-bar-column"
            title={`${advSummary.text} (Putih/Terang = ▲ Sente, Hitam/Gelap = △ Gote)`}
          >
            <div className="eval-bar-track">
              <div
                className="eval-bar-top-fill"
                style={{
                  height: `${topBarHeightPct}%`,
                  backgroundColor: topSide === 'w' ? '#2B2E36' : '#E5E7EB',
                }}
              />
              <span className="eval-end-cap top">{topSide === 'w' ? '△' : '▲'}</span>
              <span className="eval-zero-tick" />
              <span className="eval-end-cap bottom">{bottomSide === 'b' ? '▲' : '△'}</span>
              <span
                className={`eval-score-label ${
                  (evalData?.scoreCp ?? 0) >= 0
                    ? flipped
                      ? 'at-top sente-badge'
                      : 'at-bottom sente-badge'
                    : flipped
                      ? 'at-bottom gote-badge'
                      : 'at-top gote-badge'
                }`}
              >
                {formatEvalBarText(evalData)}
              </span>
            </div>
          </div>

          {/* Center Column: Top Player Bar, Board + Stands, Bottom Player Bar */}
          <div className="board-column">
            {/* Top Player Bar */}
            <div className={`player-bar ${displayPos.turn === topSide && !gameResult ? 'turn-active' : ''}`}>
              <div className="player-ident">
                <div className={`player-avatar ${topSide === 'b' ? 'sente' : 'gote'}`}>
                  {topSide === 'b' ? '王' : '玉'}
                </div>
                <div className="player-meta">
                  <div className="player-name-row">
                    <span className="player-name">{topName}</span>
                    {topElo && <span className="player-elo-tag">{topElo}</span>}
                    {topMatLead && <span className="material-diff">{topMatLead}</span>}
                  </div>
                  <span className="player-role">
                    {topSide === 'b' ? '▲ Sente (First)' : '△ Gote (Second)'}
                  </span>
                </div>
              </div>
              {baseSeconds > 0 && (
                <div
                  className={`match-clock ${
                    displayPos.turn === topSide && !gameResult ? 'running' : ''
                  } ${clocks[topSide] <= 15 ? 'critical' : clocks[topSide] <= 60 ? 'low' : ''}`}
                >
                  {formatClock(clocks[topSide])}
                </div>
              )}
            </div>

            {/* Middle Assembly: Left Komadai (Top Player) + 9x9 Board + Right Komadai (Bottom Player) */}
            <div className="board-with-stands">
              <div className="komadai-col top-stand">{renderKomadai(topSide)}</div>

              <div className={`shogi-board-frame theme-${boardTheme}`}>
                <div className="board-coords-top">
                  {(flipped ? [...FILES].reverse() : FILES).map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>

                <div className="board-and-ranks">
                  <div className={`shogi-grid theme-${boardTheme}`}>
                    {Array.from({ length: 9 }).map((_, vr) =>
                      Array.from({ length: 9 }).map((__, vc) => {
                        const r = flipped ? 8 - vr : vr;
                        const c = flipped ? 8 - vc : vc;
                        const cell = displayPos.board[r][c];
                        const isDark = (r + c) % 2 === 1;
                        const isSelected =
                          selectedSquare?.row === r && selectedSquare?.col === c;
                        const isLastFrom =
                          lastMove &&
                          lastMove.from?.row === r &&
                          lastMove.from?.col === c;
                        const isLastTo =
                          lastMove &&
                          lastMove.to.row === r &&
                          lastMove.to.col === c;
                        const isLast = Boolean(isLastFrom || isLastTo);
                        const isLegalTarget = legalTargetsForSelection.has(`${r}-${c}`);
                        const isKingChecked =
                          checkedKingSq?.row === r && checkedKingSq?.col === c;
                        const destClsBadge = isLastTo ? activeMoveCls : null;

                        // Promotion zone highlight subtle indicator
                        const inOppZone = r <= 2 || r >= 6;

                        return (
                          <button
                            key={`${r}-${c}`}
                            type="button"
                            className={`shogi-cell ${isDark ? 'dark-sq' : 'light-sq'} ${
                              inOppZone ? 'zone-sq' : ''
                            } ${isLast ? 'last-move' : ''} ${
                              destClsBadge ? 'has-cls-tint' : ''
                            } ${isSelected ? 'selected-sq' : ''} ${
                              isKingChecked ? 'checked-king' : ''
                            }`}
                            style={
                              destClsBadge
                                ? ({
                                    ['--cls-tint' as string]: destClsBadge.meta.color,
                                  } as React.CSSProperties)
                                : undefined
                            }
                            onClick={() => handleSquareClick(r, c)}
                          >
                            {cell && (
                              <ShogiPieceSvg
                                type={cell.type}
                                side={cell.side}
                                flipped={flipped}
                                showEnglishHint={showEnglishHints}
                              />
                            )}
                            {destClsBadge && (
                              <span
                                className="board-move-badge"
                                style={{ backgroundColor: destClsBadge.meta.color }}
                                title={`${destClsBadge.meta.label} (${destClsBadge.cpLoss} cp loss)`}
                              >
                                {destClsBadge.meta.symbol}
                              </span>
                            )}
                            {isLegalTarget && (
                              <span
                                className={`legal-marker ${cell ? 'capture-ring' : 'move-dot'}`}
                              />
                            )}
                          </button>
                        );
                      }),
                    )}

                    {/* Hoshi (star points) at intersections */}
                    <span className="hoshi-dot hoshi-tl" />
                    <span className="hoshi-dot hoshi-tr" />
                    <span className="hoshi-dot hoshi-bl" />
                    <span className="hoshi-dot hoshi-br" />

                    {/* Engine Best Move Arrow SVG Overlay */}
                    {bestMoveArrow && (
                      <svg
                        className="board-arrow-overlay"
                        viewBox="0 0 900 900"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <marker
                            id="bestMoveHead"
                            markerWidth="4"
                            markerHeight="4"
                            refX="2.5"
                            refY="2"
                            orient="auto"
                          >
                            <polygon points="0 0, 4 2, 0 4" fill="rgba(63, 191, 138, 0.88)" />
                          </marker>
                        </defs>
                        <line
                          x1={bestMoveArrow.x1}
                          y1={bestMoveArrow.y1}
                          x2={bestMoveArrow.x2}
                          y2={bestMoveArrow.y2}
                          stroke="rgba(63, 191, 138, 0.82)"
                          strokeWidth="14"
                          strokeLinecap="round"
                          markerEnd="url(#bestMoveHead)"
                        />
                      </svg>
                    )}

                    {/* Promotion Choice Popover */}
                    {pendingPromotion && (
                      <div className="promotion-overlay">
                        <div className="promotion-card">
                          <span className="promo-title">Promote Piece?</span>
                          <div className="promo-choices">
                            <button
                              type="button"
                              className="promo-btn promote"
                              onClick={() => commitMove(pendingPromotion.promoted)}
                            >
                              <div className="promo-piece-preview">
                                <ShogiPieceSvg
                                  type={
                                    `+${pendingPromotion.promoted.piece}` as PieceType
                                  }
                                  side={displayPos.turn}
                                  showEnglishHint={showEnglishHints}
                                />
                              </div>
                              <span>Promote (成)</span>
                            </button>
                            <button
                              type="button"
                              className="promo-btn"
                              onClick={() => commitMove(pendingPromotion.normal)}
                            >
                              <div className="promo-piece-preview">
                                <ShogiPieceSvg
                                  type={pendingPromotion.normal.piece}
                                  side={displayPos.turn}
                                  showEnglishHint={showEnglishHints}
                                />
                              </div>
                              <span>Keep (不成)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="board-coords-right">
                    {(flipped
                      ? [...(notationMode === 'kifu' ? RANKS_JP : RANKS_EN)].reverse()
                      : notationMode === 'kifu'
                        ? RANKS_JP
                        : RANKS_EN
                    ).map((rk) => (
                      <span key={rk}>{rk}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="komadai-col bottom-stand">{renderKomadai(bottomSide)}</div>
            </div>

            {/* Bottom Player Bar */}
            <div className={`player-bar ${displayPos.turn === bottomSide && !gameResult ? 'turn-active' : ''}`}>
              <div className="player-ident">
                <div className={`player-avatar ${bottomSide === 'b' ? 'sente' : 'gote'}`}>
                  {bottomSide === 'b' ? '王' : '玉'}
                </div>
                <div className="player-meta">
                  <div className="player-name-row">
                    <span className="player-name">{bottomName}</span>
                    {bottomElo && <span className="player-elo-tag">{bottomElo}</span>}
                    {bottomMatLead && <span className="material-diff">{bottomMatLead}</span>}
                  </div>
                  <span className="player-role">
                    {bottomSide === 'b' ? '▲ Sente (First)' : '△ Gote (Second)'}
                  </span>
                </div>
              </div>
              {baseSeconds > 0 && (
                <div
                  className={`match-clock ${
                    displayPos.turn === bottomSide && !gameResult ? 'running' : ''
                  } ${clocks[bottomSide] <= 15 ? 'critical' : clocks[bottomSide] <= 60 ? 'low' : ''}`}
                >
                  {formatClock(clocks[bottomSide])}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Tactical Panel: Engine Status, 2-Col Kifu Move List, Action Controls */}
      <aside className="arena-sidebar">
        <div className="sidebar-card-header">
          <div>
            <div className="sidebar-mode-title">
              {tabState.mode === 'analysis' ? 'Analysis Engine' : tabState.title}
            </div>
            <div className="sidebar-mode-sub">
              {gameResult
                ? gameResult.reason
                : `${displayPos.turn === 'b' ? '▲ Sente' : '△ Gote'} to move • Ply ${viewPly}`}
            </div>
          </div>
          {engineThinking && <span className="thinking-pill">Analyzing…</span>}
        </div>

        {/* Engine Eval Summary Strip (shown in Moves/Kifu view) */}
        {sidebarTab === 'kifu' && (
        <div className="engine-telemetry-box">
          <div className="telemetry-engine-brand">
            <span>
              {usiDetails
                ? 'YaneuraOu V9.00Git • Suisho5 NNUE'
                : 'Built-in Browser Engine'}
            </span>
            {usiDetails && usiDetails.nps > 0 && (
              <span className="mono">{(usiDetails.nps / 1_000_000).toFixed(2)}M nps</span>
            )}
          </div>
          <div className="telemetry-row">
            <span className="telemetry-label">Keunggulan</span>
            <span
              className={`telemetry-val mono ${
                advSummary.tone === 'sente'
                  ? 'win-text'
                  : advSummary.tone === 'gote'
                    ? 'warn-text'
                    : ''
              }`}
            >
              {advSummary.text}
            </span>
            <span className="telemetry-depth mono">
              D{evalData?.depth ?? 0}
              {usiDetails?.seldepth ? `/${usiDetails.seldepth}` : ''}
            </span>
          </div>
          {viewPly > 0 && lastMove && (
            <div className="telemetry-impact-row">
              <span>
                Pengaruh {notationMode === 'kifu' ? lastMove.kifu : lastMove.western}:
              </span>
              {currentMoveImpact ? (
                <span className={`impact-badge mono impact-${currentMoveImpact.tone}`}>
                  {currentMoveImpact.text} (
                  {currentMoveImpact.tone === 'pos'
                    ? 'Menguntungkan'
                    : currentMoveImpact.tone === 'neg'
                      ? 'Merugikan'
                      : 'Netral'}
                  )
                </span>
              ) : (
                <span className="impact-muted">
                  Klik langkah sebelumnya atau jalankan Ulasan untuk delta ±
                </span>
              )}
            </div>
          )}
          {evalData?.bestMove && (
            <div className="telemetry-pv mono">
              Best:{' '}
              <strong>
                {notationMode === 'kifu'
                  ? evalData.bestMove.kifu
                  : evalData.bestMove.western}
              </strong>
              {evalData.pv.length > 1 && (
                <span className="pv-rest"> {evalData.pv.slice(1, 5).join(' ')}</span>
              )}
            </div>
          )}

          {usiDetails && usiDetails.multiPvLines.length > 1 && (
            <div className="multipv-list">
              {usiDetails.multiPvLines.slice(0, 3).map((line) => {
                const cpStr =
                  line.mateIn !== undefined
                    ? line.mateIn > 0
                      ? `+M${line.mateIn}`
                      : `-M${Math.abs(line.mateIn)}`
                    : `${line.scoreCp >= 0 ? '+' : ''}${(line.scoreCp / 100).toFixed(2)}`;
                return (
                  <div key={line.multipv} className="multipv-row mono">
                    <span className="multipv-idx">#{line.multipv}</span>
                    <span
                      className={`multipv-score ${
                        line.scoreCp >= 0 ? 'win-text' : 'warn-text'
                      }`}
                    >
                      {cpStr}
                    </span>
                    <span className="multipv-pv">{line.pv.slice(0, 4).join(' ')}</span>
                  </div>
                );
              })}
            </div>
          )}

          {(tabState.mode === 'analysis' || gameResult) && moves.length > 0 && (
            <button
              type="button"
              className="review-trigger-btn"
              onClick={() => void handleRunFullReview()}
              disabled={reviewLoading}
            >
              <BarChart3 size={13} />
              <span>
                {reviewLoading
                  ? 'Menyusun Ulasan Permainan…'
                  : gameReview
                    ? 'Analisis Ulang Ulasan Permainan'
                    : 'Buat Ulasan Permainan'}
              </span>
            </button>
          )}
        </div>
        )}

        {/* Sidebar View Switcher: Kifu | Ulasan Permainan */}
        <div className="sidebar-subtabs">
          <button
            type="button"
            className={`sidebar-subtab ${sidebarTab === 'kifu' ? 'active' : ''}`}
            onClick={() => setSidebarTab('kifu')}
          >
            Daftar Langkah ({moves.length})
          </button>
          <button
            type="button"
            className={`sidebar-subtab ${sidebarTab === 'review' ? 'active' : ''}`}
            onClick={() => {
              setSidebarTab('review');
              if (!gameReview && !reviewLoading && moves.length > 0) {
                void handleRunFullReview();
              }
            }}
          >
            Ulasan Permainan
          </button>
        </div>

        {/* Game Result Banner */}
        {gameResult && (
          <div className="game-result-banner">
            <div className="result-headline">{gameResult.reason}</div>
            <div className="result-actions">
              <button
                type="button"
                className="primary-solid-btn compact"
                onClick={handleRematch}
              >
                <RotateCcw size={13} />
                <span>Rematch</span>
              </button>
            </div>
          </div>
        )}

        {sidebarTab === 'review' ? (
          <GameReviewPanel
            review={gameReview}
            loading={reviewLoading}
            progress={reviewProgress}
            userSide={resolvedPlayerSide}
            senteName={senteLabel}
            goteName={goteLabel}
            viewPly={viewPly}
            onSelectPly={setViewPly}
            onRematch={tabState.mode === 'play' ? handleRematch : undefined}
            onRunReview={() => void handleRunFullReview()}
          />
        ) : (
        /* Two-Column Move List / Kifu */
        <div className="kifu-table-wrap">
          <div className="kifu-table-head">
            <span>#</span>
            <span>▲ Sente</span>
            <span>△ Gote</span>
          </div>
          <div className="kifu-scroll">
            {moveRows.length === 0 ? (
              <div className="kifu-empty">
                Make a move on the 9×9 board or drop a captured piece from your Komadai.
              </div>
            ) : (
              moveRows.map((row) => {
                const sRev = getPlyClassification(row.sentePly);
                const gRev = row.gotePly ? getPlyClassification(row.gotePly) : null;
                const sMeta = sRev ? CATEGORY_MAP[sRev.category] : undefined;
                const gMeta = gRev ? CATEGORY_MAP[gRev.category] : undefined;
                const sImp = getMoveImpact(row.sentePly);
                const gImp = row.gotePly ? getMoveImpact(row.gotePly) : null;
                return (
                  <div key={row.num} className="kifu-row">
                    <span className="kifu-num">{row.num}.</span>
                    <button
                      type="button"
                      className={`kifu-cell ${viewPly === row.sentePly ? 'active' : ''}`}
                      onClick={() => setViewPly(row.sentePly)}
                    >
                      <span className="kifu-cell-left">
                        {sMeta && (
                          <span
                            className="kifu-cls-badge"
                            style={{ backgroundColor: sMeta.color }}
                            title={`${sMeta.label} (${sRev!.cpLoss} cp loss)`}
                          >
                            {sMeta.symbol}
                          </span>
                        )}
                        <span>
                          {row.sente
                            ? notationMode === 'kifu'
                              ? row.sente.kifu
                              : row.sente.western
                            : ''}
                        </span>
                      </span>
                      <span className="kifu-cell-right">
                        {sImp && (
                          <span className={`kifu-delta impact-${sImp.tone}`}>
                            {sImp.text}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`kifu-cell ${
                        row.gotePly && viewPly === row.gotePly ? 'active' : ''
                      }`}
                      onClick={() => row.gotePly && setViewPly(row.gotePly)}
                      disabled={!row.gote}
                    >
                      <span className="kifu-cell-left">
                        {gMeta && (
                          <span
                            className="kifu-cls-badge"
                            style={{ backgroundColor: gMeta.color }}
                            title={`${gMeta.label} (${gRev!.cpLoss} cp loss)`}
                          >
                            {gMeta.symbol}
                          </span>
                        )}
                        <span>
                          {row.gote
                            ? notationMode === 'kifu'
                              ? row.gote.kifu
                              : row.gote.western
                            : ''}
                        </span>
                      </span>
                      <span className="kifu-cell-right">
                        {gImp && (
                          <span className={`kifu-delta impact-${gImp.tone}`}>
                            {gImp.text}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}

        {/* Playback & Match Controls */}
        <div className="arena-controls-footer">
          <div className="playback-bar">
            <button
              type="button"
              className="nav-ctrl-btn"
              onClick={() => setViewPly(0)}
              disabled={viewPly === 0}
              title="Start"
            >
              <ChevronFirst size={16} />
            </button>
            <button
              type="button"
              className="nav-ctrl-btn"
              onClick={() => setViewPly(Math.max(0, viewPly - 1))}
              disabled={viewPly === 0}
              title="Previous Move"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="nav-ctrl-btn"
              onClick={() => setViewPly(Math.min(livePly, viewPly + 1))}
              disabled={viewPly >= livePly}
              title="Next Move"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="nav-ctrl-btn"
              onClick={() => setViewPly(livePly)}
              disabled={viewPly >= livePly}
              title="Live Position"
            >
              <ChevronLast size={16} />
            </button>
            <button
              type="button"
              className="nav-ctrl-btn"
              onClick={() => setFlipped((f) => !f)}
              title="Flip Board"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="tactical-actions-row">
            <button
              type="button"
              className={`action-pill-btn ${showHintArrow ? 'active' : ''}`}
              onClick={() => setShowHintArrow((s) => !s)}
              title={showHintArrow ? 'Hide Best Move Arrow' : 'Show Best Move Arrow'}
            >
              <Lightbulb size={13} />
              <span>{showHintArrow ? 'Best On' : 'Best'}</span>
            </button>

            <button
              type="button"
              className="action-pill-btn"
              onClick={handleCopySfen}
              title="Copy current position SFEN"
            >
              <Copy size={13} />
              <span>{copiedSfen ? 'Copied' : 'SFEN'}</span>
            </button>

            {tabState.mode === 'play' && !gameResult ? (
              <button
                type="button"
                className="action-pill-btn danger"
                onClick={() => {
                  const winner = isBotMatch
                    ? opponentOf(resolvedPlayerSide)
                    : opponentOf(livePos.turn);
                  setGameResult({
                    status: 'resigned',
                    winner,
                    reason: `${winner === 'b' ? 'Sente' : 'Gote'} wins by Resignation`,
                  });
                }}
                title="Resign Match"
              >
                <Flag size={13} />
                <span>Resign</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-pill-btn"
                onClick={handleRematch}
                title="Reset Board"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
