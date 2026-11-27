use crate::types::{
    BasePieceType, HandCounts, Hands, Piece, PieceType, ShogiPosition, Side, HAND_ORDER,
};

fn char_to_base_piece(ch: char) -> Option<BasePieceType> {
    match ch.to_ascii_uppercase() {
        'K' => Some(BasePieceType::K),
        'R' => Some(BasePieceType::R),
        'B' => Some(BasePieceType::B),
        'G' => Some(BasePieceType::G),
        'S' => Some(BasePieceType::S),
        'N' => Some(BasePieceType::N),
        'L' => Some(BasePieceType::L),
        'P' => Some(BasePieceType::P),
        _ => None,
    }
}

fn base_piece_char(base: BasePieceType, side: Side) -> char {
    let upper = match base {
        BasePieceType::K => 'K',
        BasePieceType::R => 'R',
        BasePieceType::B => 'B',
        BasePieceType::G => 'G',
        BasePieceType::S => 'S',
        BasePieceType::N => 'N',
        BasePieceType::L => 'L',
        BasePieceType::P => 'P',
    };
    match side {
        Side::Black => upper,
        Side::White => upper.to_ascii_lowercase(),
    }
}

pub fn parse_sfen(sfen: &str) -> Result<ShogiPosition, String> {
    let parts: Vec<&str> = sfen.split_whitespace().collect();
    if parts.len() < 3 {
        return Err(format!("Invalid SFEN: \"{sfen}\""));
    }

    let board_part = parts[0];
    let turn_part = parts[1];
    let hand_part = parts[2];
    let move_part = parts.get(3).copied();

    let ranks: Vec<&str> = board_part.split('/').collect();
    if ranks.len() != 9 {
        return Err(format!(
            "Invalid SFEN board ranks ({}): \"{sfen}\"",
            ranks.len()
        ));
    }

    let mut board: [[Option<Piece>; 9]; 9] = [[None; 9]; 9];

    for (r, rank_str) in ranks.iter().enumerate() {
        let mut c: usize = 0;
        let mut chars = rank_str.chars();
        while let Some(ch) = chars.next() {
            if ('1'..='9').contains(&ch) {
                c += (ch as u8 - b'0') as usize;
            } else {
                let (promoted, p_char) = if ch == '+' {
                    let next = chars
                        .next()
                        .ok_or_else(|| format!("Invalid promoted piece in SFEN: \"{sfen}\""))?;
                    (true, next)
                } else {
                    (false, ch)
                };

                let side = if p_char.is_uppercase() {
                    Side::Black
                } else {
                    Side::White
                };
                let base = char_to_base_piece(p_char)
                    .ok_or_else(|| format!("Unknown SFEN piece \"{p_char}\" in \"{sfen}\""))?;
                let raw_type = PieceType::from_base(base);
                let piece_type = if promoted {
                    raw_type.promote()
                } else {
                    raw_type
                };
                if c >= 9 {
                    return Err(format!("Rank {} overflow in SFEN: \"{sfen}\"", r + 1));
                }
                board[r][c] = Some(Piece { piece_type, side });
                c += 1;
            }
        }
        if c != 9 {
            return Err(format!(
                "Rank {} has {} files instead of 9 in SFEN: \"{sfen}\"",
                r + 1,
                c
            ));
        }
    }

    let turn = if turn_part == "w" {
        Side::White
    } else {
        Side::Black
    };
    let mut hands = Hands {
        b: HandCounts::default(),
        w: HandCounts::default(),
    };

    if hand_part != "-" {
        let mut count_str = String::new();
        for ch in hand_part.chars() {
            if ch.is_ascii_digit() {
                count_str.push(ch);
            } else {
                let count: u8 = if count_str.is_empty() {
                    1
                } else {
                    count_str.parse::<u8>().unwrap_or(1)
                };
                count_str.clear();

                let side = if ch.is_uppercase() {
                    Side::Black
                } else {
                    Side::White
                };
                let base = char_to_base_piece(ch)
                    .filter(|b| *b != BasePieceType::K)
                    .ok_or_else(|| format!("Invalid hand piece \"{ch}\" in SFEN: \"{sfen}\""))?;
                hands.for_side_mut(side).add(base, count);
            }
        }
    }

    let move_number = match move_part {
        Some(mp) => mp.parse::<i64>().ok().filter(|v| *v >= 1).unwrap_or(1) as u32,
        None => 1,
    };

    Ok(ShogiPosition {
        board,
        hands,
        turn,
        move_number,
    })
}

pub fn to_sfen(pos: &ShogiPosition, include_move_number: bool) -> String {
    let mut out = String::with_capacity(80);
    for (r, row) in pos.board.iter().enumerate() {
        if r > 0 {
            out.push('/');
        }
        let mut empty: u8 = 0;
        for cell_opt in row {
            match cell_opt {
                None => empty += 1,
                Some(cell) => {
                    if empty > 0 {
                        out.push((b'0' + empty) as char);
                        empty = 0;
                    }
                    if cell.piece_type.is_promoted() {
                        out.push('+');
                    }
                    out.push(base_piece_char(cell.piece_type.base(), cell.side));
                }
            }
        }
        if empty > 0 {
            out.push((b'0' + empty) as char);
        }
    }

    out.push(' ');
    out.push_str(pos.turn.as_str());
    out.push(' ');

    let hand_start_len = out.len();
    for p in HAND_ORDER {
        let n = pos.hands.b.get(p);
        if n > 0 {
            if n > 1 {
                out.push_str(&n.to_string());
            }
            out.push(base_piece_char(p, Side::Black));
        }
    }
    for p in HAND_ORDER {
        let n = pos.hands.w.get(p);
        if n > 0 {
            if n > 1 {
                out.push_str(&n.to_string());
            }
            out.push(base_piece_char(p, Side::White));
        }
    }
    if out.len() == hand_start_len {
        out.push('-');
    }

    if include_move_number {
        out.push(' ');
        out.push_str(&pos.move_number.to_string());
    }
    out
}

pub fn position_repetition_key(pos: &ShogiPosition) -> String {
    to_sfen(pos, false)
}
