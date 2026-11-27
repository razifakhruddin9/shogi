use crate::types::{
    BasePieceType, MaterialBalance, Piece, PieceType, ShogiMove, ShogiPosition, Side, Square,
    HAND_ORDER,
};

const KANJI_NUMERALS: [&str; 9] = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const RANK_LETTERS: [char; 9] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

pub fn square_to_usi(sq: Square) -> String {
    let file = 9 - sq.col;
    let rank = RANK_LETTERS[sq.row];
    format!("{file}{rank}")
}

pub fn usi_to_square(usi: &str) -> Option<Square> {
    let mut chars = usi.chars();
    let f = chars.next()?.to_digit(10)? as usize;
    let rk = chars.next()?;
    let row = RANK_LETTERS.iter().position(|&c| c == rk)?;
    if !(1..=9).contains(&f) {
        return None;
    }
    Some(Square { row, col: 9 - f })
}

#[inline]
pub const fn in_bounds(r: isize, c: isize) -> bool {
    r >= 0 && r < 9 && c >= 0 && c < 9
}

#[inline]
pub const fn is_promotion_zone(side: Side, row: usize) -> bool {
    match side {
        Side::Black => row <= 2,
        Side::White => row >= 6,
    }
}

#[inline]
pub const fn must_promote(piece_type: PieceType, side: Side, to_row: usize) -> bool {
    match piece_type {
        PieceType::P | PieceType::L => match side {
            Side::Black => to_row == 0,
            Side::White => to_row == 8,
        },
        PieceType::N => match side {
            Side::Black => to_row <= 1,
            Side::White => to_row >= 7,
        },
        _ => false,
    }
}

fn step_deltas(piece_type: PieceType, side: Side) -> &'static [(isize, isize)] {
    match (piece_type, side) {
        (PieceType::P, Side::Black) => &[(-1, 0)],
        (PieceType::P, Side::White) => &[(1, 0)],
        (PieceType::N, Side::Black) => &[(-2, -1), (-2, 1)],
        (PieceType::N, Side::White) => &[(2, -1), (2, 1)],
        (PieceType::S, Side::Black) => &[(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 1)],
        (PieceType::S, Side::White) => &[(1, -1), (1, 0), (1, 1), (-1, -1), (-1, 1)],
        (
            PieceType::G
            | PieceType::PromS
            | PieceType::PromN
            | PieceType::PromL
            | PieceType::PromP,
            Side::Black,
        ) => &[(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0)],
        (
            PieceType::G
            | PieceType::PromS
            | PieceType::PromN
            | PieceType::PromL
            | PieceType::PromP,
            Side::White,
        ) => &[(1, -1), (1, 0), (1, 1), (0, -1), (0, 1), (-1, 0)],
        (PieceType::K, _) => &[
            (-1, -1),
            (-1, 0),
            (-1, 1),
            (0, -1),
            (0, 1),
            (1, -1),
            (1, 0),
            (1, 1),
        ],
        (PieceType::PromR, _) => &[(-1, -1), (-1, 1), (1, -1), (1, 1)],
        (PieceType::PromB, _) => &[(-1, 0), (1, 0), (0, -1), (0, 1)],
        (PieceType::R | PieceType::B | PieceType::L, _) => &[],
    }
}

fn slide_deltas(piece_type: PieceType, side: Side) -> &'static [(isize, isize)] {
    match (piece_type, side) {
        (PieceType::L, Side::Black) => &[(-1, 0)],
        (PieceType::L, Side::White) => &[(1, 0)],
        (PieceType::R | PieceType::PromR, _) => &[(-1, 0), (1, 0), (0, -1), (0, 1)],
        (PieceType::B | PieceType::PromB, _) => &[(-1, -1), (-1, 1), (1, -1), (1, 1)],
        _ => &[],
    }
}

pub fn find_king(pos: &ShogiPosition, side: Side) -> Option<Square> {
    for (r, row) in pos.board.iter().enumerate() {
        for (c, cell_opt) in row.iter().enumerate() {
            if let Some(cell) = *cell_opt {
                if cell.side == side && cell.piece_type == PieceType::K {
                    return Some(Square { row: r, col: c });
                }
            }
        }
    }
    None
}

pub fn is_square_attacked(
    pos: &ShogiPosition,
    target_row: usize,
    target_col: usize,
    attacker_side: Side,
) -> bool {
    let tr = target_row as isize;
    let tc = target_col as isize;
    for r in 0..9 {
        for c in 0..9 {
            let Some(piece) = pos.board[r][c] else {
                continue;
            };
            if piece.side != attacker_side {
                continue;
            }
            let ri = r as isize;
            let ci = c as isize;

            for &(dr, dc) in step_deltas(piece.piece_type, attacker_side) {
                if ri + dr == tr && ci + dc == tc {
                    return true;
                }
            }

            for &(dr, dc) in slide_deltas(piece.piece_type, attacker_side) {
                let mut nr = ri + dr;
                let mut nc = ci + dc;
                while in_bounds(nr, nc) {
                    if nr == tr && nc == tc {
                        return true;
                    }
                    if pos.board[nr as usize][nc as usize].is_some() {
                        break;
                    }
                    nr += dr;
                    nc += dc;
                }
            }
        }
    }
    false
}

pub fn is_in_check(pos: &ShogiPosition, side: Side) -> bool {
    let Some(king) = find_king(pos, side) else {
        return false;
    };
    is_square_attacked(pos, king.row, king.col, side.opponent())
}

fn format_move_strings(
    side: Side,
    piece: PieceType,
    to: Square,
    from: Option<Square>,
    promote: bool,
    captured: Option<PieceType>,
    drop: bool,
) -> (String, String, String) {
    let to_file = 9 - to.col;
    let to_rank_kanji = KANJI_NUMERALS[to.row];
    let to_rank_letter = RANK_LETTERS[to.row];
    let side_glyph = match side {
        Side::Black => "▲",
        Side::White => "△",
    };
    let kanji = piece.kanji();
    let short_en = piece.short_en();

    if drop {
        let usi = format!("{}*{}", piece.short_en(), square_to_usi(to));
        let kifu = format!("{side_glyph}{to_file}{to_rank_kanji}{kanji}打");
        let western = format!("{short_en}*{to_file}{to_rank_letter}");
        return (usi, kifu, western);
    }

    let from_sq = from.unwrap_or(to);
    let from_usi = square_to_usi(from_sq);
    let to_usi = square_to_usi(to);
    let promo_suffix = if promote { "+" } else { "" };
    let usi = format!("{from_usi}{to_usi}{promo_suffix}");
    let promo_kifu = if promote { "成" } else { "" };
    let kifu = format!("{side_glyph}{to_file}{to_rank_kanji}{kanji}{promo_kifu}");
    let action = if captured.is_some() { "x" } else { "-" };
    let western = format!("{short_en}{action}{to_file}{to_rank_letter}{promo_suffix}");
    (usi, kifu, western)
}

pub fn apply_move_mut(pos: &mut ShogiPosition, mv: &ShogiMove) {
    let side = pos.turn;
    if mv.drop {
        let base = mv.piece.base();
        pos.hands.for_side_mut(side).dec(base);
        pos.board[mv.to.row][mv.to.col] = Some(Piece {
            piece_type: PieceType::from_base(base),
            side,
        });
    } else if let Some(from) = mv.from {
        if let Some(moving) = pos.board[from.row][from.col] {
            if let Some(target) = pos.board[mv.to.row][mv.to.col] {
                let cap_base = target.piece_type.base();
                if cap_base != BasePieceType::K {
                    pos.hands.for_side_mut(side).add(cap_base, 1);
                }
            }
            pos.board[from.row][from.col] = None;
            let final_type = if mv.promote {
                moving.piece_type.promote()
            } else {
                moving.piece_type
            };
            pos.board[mv.to.row][mv.to.col] = Some(Piece {
                piece_type: final_type,
                side,
            });
        }
    }
    pos.turn = side.opponent();
    pos.move_number += 1;
}

pub fn apply_move(pos: &ShogiPosition, mv: &ShogiMove) -> ShogiPosition {
    let mut next = pos.clone();
    apply_move_mut(&mut next, mv);
    next
}

fn generate_pseudo_board_moves(pos: &ShogiPosition, side: Side) -> Vec<ShogiMove> {
    let mut moves = Vec::with_capacity(64);
    let mut targets = Vec::with_capacity(16);

    for r in 0..9 {
        for c in 0..9 {
            let Some(piece) = pos.board[r][c] else {
                continue;
            };
            if piece.side != side {
                continue;
            }

            targets.clear();
            let ri = r as isize;
            let ci = c as isize;

            for &(dr, dc) in step_deltas(piece.piece_type, side) {
                let nr = ri + dr;
                let nc = ci + dc;
                if !in_bounds(nr, nc) {
                    continue;
                }
                let ur = nr as usize;
                let uc = nc as usize;
                match pos.board[ur][uc] {
                    None => targets.push(Square { row: ur, col: uc }),
                    Some(occ) if occ.side != side => targets.push(Square { row: ur, col: uc }),
                    _ => {}
                }
            }

            for &(dr, dc) in slide_deltas(piece.piece_type, side) {
                let mut nr = ri + dr;
                let mut nc = ci + dc;
                while in_bounds(nr, nc) {
                    let ur = nr as usize;
                    let uc = nc as usize;
                    match pos.board[ur][uc] {
                        None => targets.push(Square { row: ur, col: uc }),
                        Some(occ) => {
                            if occ.side != side {
                                targets.push(Square { row: ur, col: uc });
                            }
                            break;
                        }
                    }
                    nr += dr;
                    nc += dc;
                }
            }

            let from = Square { row: r, col: c };
            let in_zone_from = is_promotion_zone(side, r);

            for &to in &targets {
                let captured = pos.board[to.row][to.col].map(|p| p.piece_type);
                let eligible_promo = piece.piece_type.can_promote()
                    && (in_zone_from || is_promotion_zone(side, to.row));
                let forced_promo = must_promote(piece.piece_type, side, to.row);

                if !forced_promo {
                    let (usi, kifu, western) = format_move_strings(
                        side,
                        piece.piece_type,
                        to,
                        Some(from),
                        false,
                        captured,
                        false,
                    );
                    moves.push(ShogiMove {
                        from: Some(from),
                        to,
                        piece: piece.piece_type,
                        promote: false,
                        drop: false,
                        captured,
                        usi,
                        kifu,
                        western,
                    });
                }

                if eligible_promo {
                    let (usi, kifu, western) = format_move_strings(
                        side,
                        piece.piece_type,
                        to,
                        Some(from),
                        true,
                        captured,
                        false,
                    );
                    moves.push(ShogiMove {
                        from: Some(from),
                        to,
                        piece: piece.piece_type,
                        promote: true,
                        drop: false,
                        captured,
                        usi,
                        kifu,
                        western,
                    });
                }
            }
        }
    }

    moves
}

fn has_unpromoted_pawn_on_file(pos: &ShogiPosition, side: Side, col: usize) -> bool {
    for row in &pos.board {
        if let Some(cell) = row[col] {
            if cell.side == side && cell.piece_type == PieceType::P {
                return true;
            }
        }
    }
    false
}

fn has_any_legal_reply_without_uchifuzume(pos: &ShogiPosition) -> bool {
    let side = pos.turn;
    for mv in generate_pseudo_board_moves(pos, side) {
        let next = apply_move(pos, &mv);
        if !is_in_check(&next, side) {
            return true;
        }
    }

    for p_base in HAND_ORDER {
        if pos.hands.for_side(side).get(p_base) == 0 {
            continue;
        }
        let p_type = PieceType::from_base(p_base);
        for r in 0..9 {
            if must_promote(p_type, side, r) {
                continue;
            }
            for c in 0..9 {
                if pos.board[r][c].is_some() {
                    continue;
                }
                if p_base == BasePieceType::P && has_unpromoted_pawn_on_file(pos, side, c) {
                    continue;
                }
                let mut next = pos.clone();
                next.hands.for_side_mut(side).dec(p_base);
                next.board[r][c] = Some(Piece {
                    piece_type: p_type,
                    side,
                });
                next.turn = side.opponent();
                next.move_number += 1;
                if !is_in_check(&next, side) {
                    return true;
                }
            }
        }
    }

    false
}

pub fn generate_legal_moves(pos: &ShogiPosition) -> Vec<ShogiMove> {
    let side = pos.turn;
    let opp = side.opponent();
    let mut legal = Vec::with_capacity(96);

    for mv in generate_pseudo_board_moves(pos, side) {
        let next = apply_move(pos, &mv);
        if !is_in_check(&next, side) {
            legal.push(mv);
        }
    }

    for p_base in HAND_ORDER {
        if pos.hands.for_side(side).get(p_base) == 0 {
            continue;
        }
        let p_type = PieceType::from_base(p_base);
        for c in 0..9 {
            if p_base == BasePieceType::P && has_unpromoted_pawn_on_file(pos, side, c) {
                continue;
            }
            for r in 0..9 {
                if pos.board[r][c].is_some() {
                    continue;
                }
                if must_promote(p_type, side, r) {
                    continue;
                }

                let to = Square { row: r, col: c };
                let (usi, kifu, western) =
                    format_move_strings(side, p_type, to, None, false, None, true);
                let drop_move = ShogiMove {
                    from: None,
                    to,
                    piece: p_type,
                    promote: false,
                    drop: true,
                    captured: None,
                    usi,
                    kifu,
                    western,
                };

                let next = apply_move(pos, &drop_move);
                if is_in_check(&next, side) {
                    continue;
                }

                // Uchifuzume: illegal drop pawn mate
                if p_base == BasePieceType::P {
                    if let Some(opp_king) = find_king(&next, opp) {
                        let pawn_check_row = match side {
                            Side::Black => r.wrapping_sub(1),
                            Side::White => r + 1,
                        };
                        if opp_king.row == pawn_check_row
                            && opp_king.col == c
                            && !has_any_legal_reply_without_uchifuzume(&next)
                        {
                            continue;
                        }
                    }
                }

                legal.push(drop_move);
            }
        }
    }

    legal
}

pub fn find_legal_move_by_usi(pos: &ShogiPosition, usi: &str) -> Option<ShogiMove> {
    generate_legal_moves(pos).into_iter().find(|m| m.usi == usi)
}

const fn material_value_cp(piece_type: PieceType) -> i32 {
    match piece_type {
        PieceType::K => 15000,
        PieceType::R => 1000,
        PieceType::B => 850,
        PieceType::G => 560,
        PieceType::S => 510,
        PieceType::N => 360,
        PieceType::L => 340,
        PieceType::P => 100,
        PieceType::PromR => 1350,
        PieceType::PromB => 1150,
        PieceType::PromS => 580,
        PieceType::PromN => 560,
        PieceType::PromL => 550,
        PieceType::PromP => 540,
    }
}

pub fn get_material_balance(pos: &ShogiPosition) -> MaterialBalance {
    let mut b: i32 = 0;
    let mut w: i32 = 0;
    for row in &pos.board {
        for cell_opt in row {
            let Some(cell) = *cell_opt else {
                continue;
            };
            if cell.piece_type == PieceType::K {
                continue;
            }
            let val = (material_value_cp(cell.piece_type) + 50) / 100;
            match cell.side {
                Side::Black => b += val,
                Side::White => w += val,
            }
        }
    }
    for p in HAND_ORDER {
        let val = (material_value_cp(PieceType::from_base(p)) + 50) / 100;
        b += i32::from(pos.hands.b.get(p)) * val;
        w += i32::from(pos.hands.w.get(p)) * val;
    }
    MaterialBalance { b, w, diff: b - w }
}
