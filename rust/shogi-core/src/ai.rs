use crate::shogi::{apply_move, generate_legal_moves, is_in_check};
use crate::types::{
    BasePieceType, EngineEvaluation, PieceType, ShogiMove, ShogiPosition, Side, HAND_ORDER,
};

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
