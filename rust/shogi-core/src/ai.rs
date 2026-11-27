use crate::shogi::{apply_move, generate_legal_moves, is_in_check};
use crate::types::{
    BasePieceType, EngineEvaluation, PieceType, ShogiMove, ShogiPosition, Side, HAND_ORDER,
};
use serde::Serialize;

const fn board_value(piece_type: PieceType) -> i32 {
    match piece_type {
        PieceType::K => 20000,
        PieceType::R => 1000,
        PieceType::B => 860,
        PieceType::G => 560,
        PieceType::S => 500,
        PieceType::N => 360,
        PieceType::L => 340,
        PieceType::P => 100,
        PieceType::PromR => 1380,
        PieceType::PromB => 1180,
        PieceType::PromS => 580,
        PieceType::PromN => 550,
        PieceType::PromL => 540,
        PieceType::PromP => 530,
    }
}

const fn hand_value(base: BasePieceType) -> i32 {
    match base {
        BasePieceType::R => 1120,
        BasePieceType::B => 960,
        BasePieceType::G => 610,
        BasePieceType::S => 540,
        BasePieceType::N => 400,
        BasePieceType::L => 370,
        BasePieceType::P => 115,
        BasePieceType::K => 0,
    }
}

const fn positional_score(piece_type: PieceType, row: usize, col: usize) -> i32 {
    let col_dist = (4_i32 - col as i32).abs();
    let center_bonus = (4 - col_dist) * 4;
    let adv = 8 - row as i32;
    match piece_type {
        PieceType::P => adv * 6 + center_bonus,
        PieceType::S | PieceType::G => adv * 4 + center_bonus,
        PieceType::PromP | PieceType::PromS | PieceType::PromN | PieceType::PromL => {
            adv * 8 + center_bonus * 2
        }
        PieceType::R | PieceType::PromR => adv * 5 + center_bonus,
        PieceType::B | PieceType::PromB => center_bonus * 3,
        PieceType::K => {
            if row >= 7 {
                35 + col_dist * 8
            } else {
                -25
            }
        }
        PieceType::N | PieceType::L => center_bonus,
    }
}

pub fn evaluate_position(pos: &ShogiPosition) -> i32 {
    let mut score: i32 = 0;

    for (r, row) in pos.board.iter().enumerate() {
        for (c, cell_opt) in row.iter().enumerate() {
            let Some(cell) = *cell_opt else {
                continue;
            };
            match cell.side {
                Side::Black => {
                    score += board_value(cell.piece_type) + positional_score(cell.piece_type, r, c);
                }
                Side::White => {
                    score -= board_value(cell.piece_type)
                        + positional_score(cell.piece_type, 8 - r, 8 - c);
                }
            }
        }
    }

    for p in HAND_ORDER {
        score += i32::from(pos.hands.b.get(p)) * hand_value(p);
        score -= i32::from(pos.hands.w.get(p)) * hand_value(p);
    }

    score += match pos.turn {
        Side::Black => 18,
        Side::White => -18,
    };
    score
}

fn score_move_ordering(mv: &ShogiMove) -> i32 {
    let mut s: i32 = 0;
    if let Some(cap) = mv.captured {
        s += 1000 + board_value(cap) - (board_value(mv.piece) / 10);
    }
    if mv.promote {
        s += 450;
    }
    if mv.drop {
        s += 120;
    }
    let dist = (4_i32 - mv.to.col as i32).abs() + (4_i32 - mv.to.row as i32).abs();
    s += 20 - dist;
    s
}

fn order_moves(mut moves: Vec<ShogiMove>) -> Vec<ShogiMove> {
    moves.sort_by_key(|m| std::cmp::Reverse(score_move_ordering(m)));
    moves
}

struct SearchCtx {
    nodes: u64,
    max_nodes: u64,
    aborted: bool,
}

const INF: i32 = 1_000_000;

fn negamax(
    pos: &ShogiPosition,
    depth: u32,
    mut alpha: i32,
    beta: i32,
    ply: i32,
    ctx: &mut SearchCtx,
) -> (i32, Vec<String>) {
    ctx.nodes += 1;
    if (ctx.nodes & 255) == 0 && ctx.nodes >= ctx.max_nodes {
        ctx.aborted = true;
        return (0, Vec::new());
    }

    let moves = generate_legal_moves(pos);
    if moves.is_empty() {
        return (-19000 + ply, Vec::new());
    }

    if depth == 0 {
        let raw = evaluate_position(pos);
        let signed = match pos.turn {
            Side::Black => raw,
            Side::White => -raw,
        };
        return (signed, Vec::new());
    }

    let ordered = order_moves(moves);
    let mut best_score = -INF;
    let mut best_pv: Vec<String> = Vec::new();

    for mv in &ordered {
        let next = apply_move(pos, mv);
        let (child_score, child_pv) = negamax(&next, depth - 1, -beta, -alpha, ply + 1, ctx);
        if ctx.aborted {
            return (0, Vec::new());
        }
        let val = -child_score;
        if val > best_score {
            best_score = val;
            best_pv.clear();
            best_pv.push(mv.usi.clone());
            best_pv.extend(child_pv);
        }
        if val > alpha {
            alpha = val;
        }
        if alpha >= beta {
            break;
        }
    }

    (best_score, best_pv)
}

pub fn search_best_move(pos: &ShogiPosition, max_depth: u32, max_nodes: u64) -> EngineEvaluation {
    let legal = order_moves(generate_legal_moves(pos));
    if legal.is_empty() {
        let check = is_in_check(pos, pos.turn);
        let losing_score = match pos.turn {
            Side::Black => -19000,
            Side::White => 19000,
        };
        return EngineEvaluation {
            score_cp: if check { losing_score } else { 0 },
            mate_in: Some(match pos.turn {
                Side::Black => -1,
                Side::White => 1,
            }),
            best_move: None,
            pv: Vec::new(),
            depth: 0,
            nodes: 1,
        };
    }

    let mut ctx = SearchCtx {
        nodes: 0,
        max_nodes: max_nodes.max(2000),
        aborted: false,
    };

    let mut best_move = legal[0].clone();
    let mut best_score_from_turn: i32 = 0;
    let mut best_pv: Vec<String> = vec![legal[0].usi.clone()];
    let mut reached_depth: u32 = 1;

    for d in 1..=max_depth.max(1) {
        let mut alpha = -INF;
        let beta = INF;
        let mut cur_best_move = best_move.clone();
        let mut cur_best_score = -INF;
        let mut cur_best_pv: Vec<String> = Vec::new();

        for mv in &legal {
            let next = apply_move(pos, mv);
            let (child_score, child_pv) = negamax(&next, d - 1, -beta, -alpha, 1, &mut ctx);
            if ctx.aborted {
                break;
            }
            let val = -child_score;
            if val > cur_best_score {
                cur_best_score = val;
                cur_best_move = mv.clone();
                cur_best_pv.clear();
                cur_best_pv.push(mv.usi.clone());
                cur_best_pv.extend(child_pv);
            }
            if val > alpha {
                alpha = val;
            }
        }

        if ctx.aborted {
            break;
        }
        best_move = cur_best_move;
        best_score_from_turn = cur_best_score;
        best_pv = cur_best_pv;
        reached_depth = d;
        if cur_best_score.abs() > 18000 {
            break;
        }
    }

    let score_cp = match pos.turn {
        Side::Black => best_score_from_turn,
        Side::White => -best_score_from_turn,
    };

    let mate_in = if score_cp.abs() > 18000 {
        let plies = (19000 - score_cp.abs()).max(1);
        let moves_to_mate = (plies + 1) / 2;
        Some(if score_cp > 0 {
            moves_to_mate
        } else {
            -moves_to_mate
        })
    } else {
        None
    };

    EngineEvaluation {
        score_cp,
        mate_in,
        best_move: Some(best_move),
        pv: best_pv,
        depth: reached_depth,
        nodes: ctx.nodes,
    }
}

pub const fn classify_move_delta(
    prev_eval_cp: i32,
    next_eval_cp: i32,
    mover_side: Side,
) -> &'static str {
    let loss = match mover_side {
        Side::Black => prev_eval_cp - next_eval_cp,
        Side::White => next_eval_cp - prev_eval_cp,
    };
    if loss <= 25 {
        "best"
    } else if loss <= 80 {
        "good"
    } else if loss <= 160 {
        "inaccuracy"
    } else if loss <= 300 {
        "mistake"
    } else {
        "blunder"
    }
}

// ============================================================================
// Upgraded Turbo Search (Transposition Table + Quiescence + Exact MultiPV)
// Powers Vercel Serverless Rust/WASM endpoints and flagship 2800-tier play
// without altering search_best_move parity against recorded TS test cases.
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiPvLineOutput {
    pub multipv: u32,
    pub depth: u32,
    pub seldepth: u32,
    pub score_cp: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mate_in: Option<i32>,
    pub pv: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsiAnalysisOutput {
    pub depth: u32,
    pub seldepth: u32,
    pub nodes: u64,
    pub score_cp_from_turn: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mate_in_from_turn: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_move_usi: Option<String>,
    pub pv: Vec<String>,
    pub multi_pv_lines: Vec<MultiPvLineOutput>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameReviewPlyOutput {
    pub ply: usize,
    pub turn: Side,
    pub score_cp: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mate_in: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_move_usi: Option<String>,
    pub depth: u32,
    pub nodes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameReviewOutput {
    pub plies: Vec<GameReviewPlyOutput>,
}

const TT_SIZE: usize = 1 << 15;
const TT_MASK: usize = TT_SIZE - 1;
const MATE_THRESHOLD: i32 = 18_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TtFlag {
    Exact,
    LowerBound,
    UpperBound,
}

#[derive(Debug, Clone)]
struct TtEntry {
    key: u64,
    depth: u8,
    flag: TtFlag,
    score: i32,
    best_usi: Option<String>,
}

struct TurboCtx {
    nodes: u64,
    max_nodes: u64,
    aborted: bool,
    seldepth: u32,
    tt: Vec<Option<TtEntry>>,
}

impl TurboCtx {
    fn new(max_nodes: u64) -> Self {
        Self {
            nodes: 0,
            max_nodes: max_nodes.max(2_000),
            aborted: false,
            seldepth: 0,
            tt: vec![None; TT_SIZE],
        }
    }
}

#[inline]
const fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x ^ (x >> 31)
}

#[inline]
const fn piece_discriminant(pt: PieceType) -> u64 {
    match pt {
        PieceType::K => 1,
        PieceType::R => 2,
        PieceType::B => 3,
        PieceType::G => 4,
        PieceType::S => 5,
        PieceType::N => 6,
        PieceType::L => 7,
        PieceType::P => 8,
        PieceType::PromR => 9,
        PieceType::PromB => 10,
        PieceType::PromS => 11,
        PieceType::PromN => 12,
        PieceType::PromL => 13,
        PieceType::PromP => 14,
    }
}

fn hash_position(pos: &ShogiPosition) -> u64 {
    let mut h: u64 = match pos.turn {
        Side::Black => 0x243F_6A88_85A3_08D3,
        Side::White => 0x1319_8A2E_0370_7344,
    };

    for (r, row) in pos.board.iter().enumerate() {
        for (c, cell_opt) in row.iter().enumerate() {
            if let Some(cell) = *cell_opt {
                let side_bit = match cell.side {
                    Side::Black => 0_u64,
                    Side::White => 1_u64,
                };
                let code = ((r as u64) << 9)
                    | ((c as u64) << 5)
                    | (side_bit << 4)
                    | piece_discriminant(cell.piece_type);
                h ^= splitmix64(code ^ 0xA409_3822_299F_31D0);
            }
        }
    }

    for (i, p) in HAND_ORDER.iter().enumerate() {
        let b_cnt = u64::from(pos.hands.b.get(*p));
        if b_cnt > 0 {
            h ^= splitmix64(((i as u64) << 12) | (b_cnt << 4) | 0x1);
        }
        let w_cnt = u64::from(pos.hands.w.get(*p));
        if w_cnt > 0 {
            h ^= splitmix64(((i as u64) << 12) | (w_cnt << 4) | 0x2);
        }
    }

    h
}

#[inline]
fn eval_for_turn(pos: &ShogiPosition) -> i32 {
    let raw = evaluate_position(pos);
    match pos.turn {
        Side::Black => raw,
        Side::White => -raw,
    }
}

#[inline]
fn score_to_mate_in(score_from_turn: i32) -> Option<i32> {
    if score_from_turn.abs() > MATE_THRESHOLD {
        let plies = (19_000 - score_from_turn.abs()).max(1);
        let moves = (plies + 1) / 2;
        Some(if score_from_turn > 0 { moves } else { -moves })
    } else {
        None
    }
}

fn order_moves_with_hint(mut moves: Vec<ShogiMove>, tt_best_usi: Option<&str>) -> Vec<ShogiMove> {
    moves.sort_by_key(|m| {
        let bonus = if tt_best_usi.is_some_and(|u| u == m.usi) {
            100_000
        } else {
            0
        };
        std::cmp::Reverse(bonus + score_move_ordering(m))
    });
    moves
}

fn quiesce(
    pos: &ShogiPosition,
    mut alpha: i32,
    beta: i32,
    ply: i32,
    q_ply: u32,
    ctx: &mut TurboCtx,
) -> i32 {
    ctx.nodes += 1;
    if (ctx.nodes & 255) == 0 && ctx.nodes >= ctx.max_nodes {
        ctx.aborted = true;
        return 0;
    }
    if (ply as u32) > ctx.seldepth {
        ctx.seldepth = ply as u32;
    }

    let stand_pat = eval_for_turn(pos);
    if stand_pat >= beta {
        return beta;
    }
    if stand_pat > alpha {
        alpha = stand_pat;
    }
    if q_ply >= 2 {
        return alpha;
    }

    let legal = generate_legal_moves(pos);
    if legal.is_empty() {
        return -19_000 + ply;
    }

    let mut tactical: Vec<ShogiMove> = legal
        .into_iter()
        .filter(|m| m.captured.is_some() || m.promote)
        .collect();
    if tactical.is_empty() {
        return alpha;
    }
    tactical.sort_by_key(|m| std::cmp::Reverse(score_move_ordering(m)));

    for mv in tactical.iter().take(8) {
        let next = apply_move(pos, mv);
        let score = -quiesce(&next, -beta, -alpha, ply + 1, q_ply + 1, ctx);
        if ctx.aborted {
            return 0;
        }
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }

    alpha
}

fn turbo_negamax(
    pos: &ShogiPosition,
    depth: u32,
    mut alpha: i32,
    mut beta: i32,
    ply: i32,
    ctx: &mut TurboCtx,
) -> (i32, Vec<String>) {
    ctx.nodes += 1;
    if (ctx.nodes & 255) == 0 && ctx.nodes >= ctx.max_nodes {
        ctx.aborted = true;
        return (0, Vec::new());
    }
    if (ply as u32) > ctx.seldepth {
        ctx.seldepth = ply as u32;
    }

    let alpha_orig = alpha;
    let hash = hash_position(pos);
    let tt_idx = (hash as usize) & TT_MASK;
    let mut tt_best_usi: Option<String> = None;

    if let Some(entry) = &ctx.tt[tt_idx] {
        if entry.key == hash {
            tt_best_usi = entry.best_usi.clone();
            if u32::from(entry.depth) >= depth && entry.score.abs() < MATE_THRESHOLD {
                match entry.flag {
                    TtFlag::Exact => {
                        let pv = entry.best_usi.clone().into_iter().collect();
                        return (entry.score, pv);
                    }
                    TtFlag::LowerBound => {
                        if entry.score > alpha {
                            alpha = entry.score;
                        }
                    }
                    TtFlag::UpperBound => {
                        if entry.score < beta {
                            beta = entry.score;
                        }
                    }
                }
                if alpha >= beta {
                    let pv = entry.best_usi.clone().into_iter().collect();
                    return (entry.score, pv);
                }
            }
        }
    }

    let moves = generate_legal_moves(pos);
    if moves.is_empty() {
        return (-19_000 + ply, Vec::new());
    }

    if depth == 0 {
        let q = quiesce(pos, alpha, beta, ply, 0, ctx);
        return (q, Vec::new());
    }

    let ordered = order_moves_with_hint(moves, tt_best_usi.as_deref());
    let mut best_score = -INF;
    let mut best_pv: Vec<String> = Vec::new();
    let mut best_usi: Option<String> = None;

    for mv in &ordered {
        let next = apply_move(pos, mv);
        let (child_score, child_pv) = turbo_negamax(&next, depth - 1, -beta, -alpha, ply + 1, ctx);
        if ctx.aborted {
            return (0, Vec::new());
        }
        let val = -child_score;
        if val > best_score {
            best_score = val;
            best_usi = Some(mv.usi.clone());
            best_pv.clear();
            best_pv.push(mv.usi.clone());
            best_pv.extend(child_pv);
        }
        if val > alpha {
            alpha = val;
        }
        if alpha >= beta {
            break;
        }
    }

    if best_score.abs() < MATE_THRESHOLD {
        let flag = if best_score <= alpha_orig {
            TtFlag::UpperBound
        } else if best_score >= beta {
            TtFlag::LowerBound
        } else {
            TtFlag::Exact
        };
        ctx.tt[tt_idx] = Some(TtEntry {
            key: hash,
            depth: depth.min(255) as u8,
            flag,
            score: best_score,
            best_usi,
        });
    }

    (best_score, best_pv)
}

fn analyze_multipv_with_ctx(
    pos: &ShogiPosition,
    max_depth: u32,
    multi_pv: u32,
    ctx: &mut TurboCtx,
) -> UsiAnalysisOutput {
    let mut root_moves = order_moves(generate_legal_moves(pos));
    if root_moves.is_empty() {
        let check = is_in_check(pos, pos.turn);
        return UsiAnalysisOutput {
            depth: 0,
            seldepth: 0,
            nodes: 1,
            score_cp_from_turn: if check { -19_000 } else { 0 },
            mate_in_from_turn: if check { Some(-1) } else { None },
            best_move_usi: None,
            pv: Vec::new(),
            multi_pv_lines: Vec::new(),
        };
    }

    let k = (multi_pv.clamp(1, 5) as usize).min(root_moves.len());
    let target_depth = max_depth.clamp(1, 8);
    let mut reached_depth: u32 = 1;
    let mut completed_lines: Vec<(i32, Vec<String>, String)> = vec![(
        eval_for_turn(pos),
        vec![root_moves[0].usi.clone()],
        root_moves[0].usi.clone(),
    )];

    for d in 1..=target_depth {
        let mut iter_lines: Vec<(i32, Vec<String>, String)> = Vec::with_capacity(k + 1);
        let mut iter_aborted = false;

        for mv in &root_moves {
            let cutoff_alpha = if iter_lines.len() < k {
                -INF
            } else {
                iter_lines[k - 1].0
            };

            let next = apply_move(pos, mv);
            let (child_score, child_pv) = turbo_negamax(&next, d - 1, -INF, -cutoff_alpha, 1, ctx);
            if ctx.aborted {
                iter_aborted = true;
                break;
            }
            let val = -child_score;

            if iter_lines.len() < k || val > iter_lines[k - 1].0 {
                let mut pv = Vec::with_capacity(1 + child_pv.len());
                pv.push(mv.usi.clone());
                pv.extend(child_pv);
                iter_lines.push((val, pv, mv.usi.clone()));
                iter_lines.sort_by_key(|a| std::cmp::Reverse(a.0));
                if iter_lines.len() > k {
                    iter_lines.truncate(k);
                }
            }
        }

        if iter_aborted {
            if d == 1 && !iter_lines.is_empty() {
                completed_lines = iter_lines;
                reached_depth = 1;
            }
            break;
        }

        if !iter_lines.is_empty() {
            completed_lines = iter_lines;
            reached_depth = d;

            // Reorder root moves so top lines from depth d are searched first at depth d + 1
            let top_usis: Vec<String> = completed_lines.iter().map(|l| l.2.clone()).collect();
            root_moves.sort_by_key(|m| {
                top_usis
                    .iter()
                    .position(|u| u == &m.usi)
                    .unwrap_or(usize::MAX)
            });

            if k == 1 && completed_lines[0].0.abs() > MATE_THRESHOLD {
                break;
            }
        }
    }

    let seldepth = ctx.seldepth.max(reached_depth);
    let multi_pv_lines: Vec<MultiPvLineOutput> = completed_lines
        .iter()
        .enumerate()
        .map(|(idx, (score, pv, _))| MultiPvLineOutput {
            multipv: (idx + 1) as u32,
            depth: reached_depth,
            seldepth,
            score_cp: *score,
            mate_in: score_to_mate_in(*score),
            pv: pv.clone(),
        })
        .collect();

    let primary = multi_pv_lines.first();
    UsiAnalysisOutput {
        depth: reached_depth,
        seldepth,
        nodes: ctx.nodes.max(1),
        score_cp_from_turn: primary.map_or(0, |l| l.score_cp),
        mate_in_from_turn: primary.and_then(|l| l.mate_in),
        best_move_usi: primary.and_then(|l| l.pv.first().cloned()),
        pv: primary.map_or_else(Vec::new, |l| l.pv.clone()),
        multi_pv_lines,
    }
}

pub fn analyze_multipv(
    pos: &ShogiPosition,
    max_depth: u32,
    max_nodes: u64,
    multi_pv: u32,
) -> UsiAnalysisOutput {
    let mut ctx = TurboCtx::new(max_nodes);
    analyze_multipv_with_ctx(pos, max_depth, multi_pv, &mut ctx)
}

pub fn review_game(
    initial_pos: &ShogiPosition,
    moves_usi: &[String],
    max_depth: u32,
    max_nodes_per_ply: u64,
) -> GameReviewOutput {
    let mut ctx = TurboCtx::new(max_nodes_per_ply);
    let mut pos = initial_pos.clone();
    let mut plies: Vec<GameReviewPlyOutput> = Vec::with_capacity(moves_usi.len() + 1);

    for ply in 0..=moves_usi.len() {
        ctx.nodes = 0;
        ctx.aborted = false;
        ctx.seldepth = 0;
        ctx.max_nodes = max_nodes_per_ply.max(3_000);

        let res = analyze_multipv_with_ctx(&pos, max_depth, 1, &mut ctx);
        let sign = match pos.turn {
            Side::Black => 1,
            Side::White => -1,
        };
        plies.push(GameReviewPlyOutput {
            ply,
            turn: pos.turn,
            score_cp: res.score_cp_from_turn * sign,
            mate_in: res.mate_in_from_turn.map(|m| m * sign),
            best_move_usi: res.best_move_usi,
            depth: res.depth,
            nodes: res.nodes,
        });

        if let Some(usi) = moves_usi.get(ply) {
            if let Some(mv) = crate::shogi::find_legal_move_by_usi(&pos, usi) {
                pos = apply_move(&pos, &mv);
            } else {
                break;
            }
        }
    }

    GameReviewOutput { plies }
}
