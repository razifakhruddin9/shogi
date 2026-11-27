pub mod ai;
pub mod sfen;
pub mod shogi;
pub mod types;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

pub fn position_from_sfen_and_moves(
    sfen_str: &str,
    moves_usi: &[String],
) -> Result<types::ShogiPosition, String> {
    let resolved = if sfen_str.trim().is_empty() || sfen_str.trim() == "startpos" {
        types::INITIAL_SFEN
    } else {
        sfen_str.trim()
    };
    let mut pos = sfen::parse_sfen(resolved)?;
    for usi in moves_usi {
        let Some(mv) = shogi::find_legal_move_by_usi(&pos, usi) else {
            break;
        };
        pos = shogi::apply_move(&pos, &mv);
    }
    Ok(pos)
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_sfen_json(sfen_str: &str) -> Result<String, JsValue> {
    let pos = sfen::parse_sfen(sfen_str).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&pos).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_to_sfen(pos_json: &str, include_move_number: bool) -> Result<String, JsValue> {
    let pos: types::ShogiPosition =
        serde_json::from_str(pos_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(sfen::to_sfen(&pos, include_move_number))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_generate_legal_moves_json(sfen_str: &str) -> Result<String, JsValue> {
    let pos = sfen::parse_sfen(sfen_str).map_err(|e| JsValue::from_str(&e))?;
    let moves = shogi::generate_legal_moves(&pos);
    serde_json::to_string(&moves).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_evaluate_sfen(sfen_str: &str) -> Result<i32, JsValue> {
    let pos = sfen::parse_sfen(sfen_str).map_err(|e| JsValue::from_str(&e))?;
    Ok(ai::evaluate_position(&pos))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_search_best_move_json(
    sfen_str: &str,
    max_depth: u32,
    max_nodes: u32,
) -> Result<String, JsValue> {
    let pos = sfen::parse_sfen(sfen_str).map_err(|e| JsValue::from_str(&e))?;
    let eval = ai::search_best_move(&pos, max_depth, u64::from(max_nodes));
    serde_json::to_string(&eval).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_material_balance_json(sfen_str: &str) -> Result<String, JsValue> {
    let pos = sfen::parse_sfen(sfen_str).map_err(|e| JsValue::from_str(&e))?;
    let bal = shogi::get_material_balance(&pos);
    serde_json::to_string(&bal).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_analyze_multipv_json(
    sfen_str: &str,
    moves_json: &str,
    max_depth: u32,
    max_nodes: u32,
    multi_pv: u32,
) -> Result<String, JsValue> {
    let moves_usi: Vec<String> = if moves_json.trim().is_empty() {
        Vec::new()
    } else {
        serde_json::from_str(moves_json).map_err(|e| JsValue::from_str(&e.to_string()))?
    };
    let pos =
        position_from_sfen_and_moves(sfen_str, &moves_usi).map_err(|e| JsValue::from_str(&e))?;
    let res = ai::analyze_multipv(&pos, max_depth, u64::from(max_nodes), multi_pv);
    serde_json::to_string(&res).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_review_game_json(
    initial_sfen: &str,
    moves_json: &str,
    max_depth: u32,
    max_nodes_per_ply: u32,
) -> Result<String, JsValue> {
    let moves_usi: Vec<String> = if moves_json.trim().is_empty() {
        Vec::new()
    } else {
        serde_json::from_str(moves_json).map_err(|e| JsValue::from_str(&e.to_string()))?
    };
    let initial_pos =
        position_from_sfen_and_moves(initial_sfen, &[]).map_err(|e| JsValue::from_str(&e))?;
    let review = ai::review_game(
        &initial_pos,
        &moves_usi,
        max_depth,
        u64::from(max_nodes_per_ply),
    );
    serde_json::to_string(&review).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{classify_move_delta, evaluate_position, search_best_move};
    use crate::sfen::{parse_sfen, position_repetition_key, to_sfen};
    use crate::shogi::{
        apply_move, find_legal_move_by_usi, generate_legal_moves, get_material_balance, is_in_check,
    };
    use crate::types::{Side, INITIAL_SFEN};
    use serde::Deserialize;
    use std::fs;
    use std::path::Path;

    #[test]
    fn roundtrip_initial_sfen() {
        let pos = parse_sfen(INITIAL_SFEN).expect("valid initial sfen");
        assert_eq!(to_sfen(&pos, true), INITIAL_SFEN);
        assert_eq!(
            position_repetition_key(&pos),
            "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -"
        );
    }

    #[test]
    fn opening_generates_30_legal_moves() {
        let pos = parse_sfen(INITIAL_SFEN).expect("valid initial sfen");
        let moves = generate_legal_moves(&pos);
        assert_eq!(moves.len(), 30);
    }

    #[test]
    fn enforces_nifu_and_tokin_exception() {
        let pos = parse_sfen("4k4/9/9/9/9/9/4P4/9/4K4 b P 1").expect("valid sfen");
        let moves = generate_legal_moves(&pos);
        assert!(
            moves
                .iter()
                .filter(|m| m.drop && m.piece == types::PieceType::P && m.to.col == 4)
                .count()
                == 0
        );
        assert!(
            moves
                .iter()
                .filter(|m| m.drop && m.piece == types::PieceType::P && m.to.col == 5)
                .count()
                > 0
        );

        let pos_tokin = parse_sfen("4k4/9/9/4+P4/9/9/9/9/4K4 b P 1").expect("valid sfen");
        assert!(find_legal_move_by_usi(&pos_tokin, "P*5f").is_some());
    }

    #[test]
    fn enforces_uchifuzume_and_allows_atamakin() {
        let uchi = parse_sfen("3lkl3/9/4G4/9/9/9/9/9/4K4 b P 1").expect("valid sfen");
        assert!(find_legal_move_by_usi(&uchi, "P*5b").is_none());

        let atamakin = parse_sfen("4k4/9/4P4/9/9/9/9/9/4K4 b G 1").expect("valid sfen");
        let mv = find_legal_move_by_usi(&atamakin, "G*5b").expect("G*5b legal");
        let after = apply_move(&atamakin, &mv);
        assert!(is_in_check(&after, Side::White));
        assert!(generate_legal_moves(&after).is_empty());
    }

    #[test]
    fn forces_last_rank_pawn_promotion() {
        let pos = parse_sfen("4k4/P8/9/9/9/9/9/9/4K4 b - 1").expect("valid sfen");
        assert!(find_legal_move_by_usi(&pos, "9b9a").is_none());
        assert!(find_legal_move_by_usi(&pos, "9b9a+").is_some());
    }

    #[test]
    fn invalid_sfen_returns_err_not_panic() {
        assert!(parse_sfen("not-a-sfen").is_err());
        assert!(parse_sfen("9/9/9 b - 1").is_err());
        assert!(parse_sfen("9/9/9/9/9/9/9/9/9 b K 1").is_err());
        assert!(parse_sfen("9/9/9/9/9/9/9/9/8+ b - 1").is_err());
    }

    #[test]
    fn ai_finds_atamakin_mate_in_1() {
        let pos = parse_sfen("4k4/9/4P4/9/9/9/9/9/4K4 b G 1").expect("valid sfen");
        let eval = search_best_move(&pos, 2, 100_000);
        assert_eq!(
            eval.best_move.as_ref().map(|m| m.usi.as_str()),
            Some("G*5b")
        );
        assert_eq!(eval.mate_in, Some(1));
    }

    #[test]
    fn turbo_multipv_finds_mate_and_opening_lines_and_review() {
        let mate_pos = parse_sfen("4k4/9/4P4/9/9/9/9/9/4K4 b G 1").expect("valid sfen");
        let mate_eval = ai::analyze_multipv(&mate_pos, 3, 80_000, 3);
        assert_eq!(mate_eval.best_move_usi.as_deref(), Some("G*5b"));
        assert_eq!(mate_eval.mate_in_from_turn, Some(1));
        assert!(!mate_eval.multi_pv_lines.is_empty());

        let start = position_from_sfen_and_moves("startpos", &[]).expect("startpos");
        let opening = ai::analyze_multipv(&start, 3, 120_000, 3);
        assert_eq!(opening.multi_pv_lines.len(), 3);
        assert!(opening.best_move_usi.is_some());
        assert!(opening.multi_pv_lines[0].score_cp >= opening.multi_pv_lines[1].score_cp);
        assert!(opening.multi_pv_lines[1].score_cp >= opening.multi_pv_lines[2].score_cp);

        let sample_moves = vec![
            "7g7f".to_string(),
            "3c3d".to_string(),
            "2g2f".to_string(),
            "8c8d".to_string(),
        ];
        let review = ai::review_game(&start, &sample_moves, 2, 20_000);
        assert_eq!(review.plies.len(), 5);
        assert_eq!(review.plies[0].turn, Side::Black);
        assert_eq!(review.plies[1].turn, Side::White);
        assert!(review.plies[0].best_move_usi.is_some());
    }

    #[test]
    fn multipv_engine_finds_mate_and_three_opening_lines() {
        let mate_pos = parse_sfen("4k4/9/4P4/9/9/9/9/9/4K4 b G 1").expect("valid sfen");
        let mate_out = ai::analyze_multipv(&mate_pos, 3, 150_000, 1);
        assert_eq!(mate_out.best_move_usi.as_deref(), Some("G*5b"));
        assert_eq!(mate_out.mate_in_from_turn, Some(1));

        let open_pos =
            position_from_sfen_and_moves("startpos", &["7g7f".to_string(), "3c3d".to_string()])
                .expect("valid startpos + opening moves");
        assert_eq!(open_pos.turn, Side::Black);
        let open_out = ai::analyze_multipv(&open_pos, 3, 250_000, 3);
        assert_eq!(open_out.multi_pv_lines.len(), 3);
        assert!(open_out.depth >= 2);
        assert!(open_out.seldepth >= open_out.depth);
        let first_moves: Vec<&str> = open_out
            .multi_pv_lines
            .iter()
            .filter_map(|l| l.pv.first().map(String::as_str))
            .collect();
        assert_eq!(first_moves.len(), 3);
        assert_ne!(first_moves[0], first_moves[1]);
        assert_ne!(first_moves[1], first_moves[2]);
    }

    #[derive(Deserialize)]
    struct RecordedCase {
        fn_name: String,
        sfen: String,
        #[serde(default)]
        usi: Option<String>,
        #[serde(default)]
        depth: Option<u32>,
        #[serde(default)]
        prev_cp: Option<i32>,
        #[serde(default)]
        next_cp: Option<i32>,
        #[serde(default)]
        side: Option<Side>,
        expected: serde_json::Value,
    }

    #[test]
    fn replay_recorded_typescript_cases_byte_for_byte() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("cases.jsonl");
        if !path.exists() {
            return;
        }
        let raw = fs::read_to_string(&path).expect("read cases.jsonl");
        let mut count = 0usize;
        for (idx, line) in raw.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let case: RecordedCase =
                serde_json::from_str(line).unwrap_or_else(|e| panic!("line {}: {e}", idx + 1));
            count += 1;

            match case.fn_name.as_str() {
                "sfen_roundtrip" => {
                    let actual = match parse_sfen(&case.sfen) {
                        Ok(pos) => serde_json::json!({
                            "ok": true,
                            "sfen": to_sfen(&pos, true),
                            "repKey": position_repetition_key(&pos),
                        }),
                        Err(_) => serde_json::json!({ "ok": false }),
                    };
                    assert_eq!(
                        actual,
                        case.expected,
                        "sfen_roundtrip mismatch at line {}",
                        idx + 1
                    );
                }
                "legal_moves" => {
                    let pos = parse_sfen(&case.sfen).expect("valid case sfen");
                    let moves = generate_legal_moves(&pos);
                    let actual = serde_json::json!({
                        "count": moves.len(),
                        "inCheck": is_in_check(&pos, pos.turn),
                        "material": get_material_balance(&pos),
                        "evalCp": evaluate_position(&pos),
                        "moves": moves.iter().map(|m| (&m.usi, &m.kifu, &m.western)).collect::<Vec<_>>(),
                    });
                    assert_eq!(
                        actual,
                        case.expected,
                        "legal_moves mismatch at line {}",
                        idx + 1
                    );
                }
                "apply_usi" => {
                    let pos = parse_sfen(&case.sfen).expect("valid case sfen");
                    let usi = case.usi.as_deref().unwrap_or("");
                    let mv = find_legal_move_by_usi(&pos, usi)
                        .unwrap_or_else(|| panic!("move {usi} not legal at line {}", idx + 1));
                    let next = apply_move(&pos, &mv);
                    let actual = serde_json::json!({
                        "nextSfen": to_sfen(&next, true),
                        "inCheck": is_in_check(&next, next.turn),
                        "kifu": mv.kifu,
                        "western": mv.western,
                    });
                    assert_eq!(
                        actual,
                        case.expected,
                        "apply_usi mismatch at line {}",
                        idx + 1
                    );
                }
                "search_best_move" => {
                    let pos = parse_sfen(&case.sfen).expect("valid case sfen");
                    let eval = search_best_move(&pos, case.depth.unwrap_or(2), 2_000_000);
                    let actual = serde_json::json!({
                        "bestUsi": eval.best_move.as_ref().map(|m| m.usi.clone()),
                        "scoreCp": eval.score_cp,
                        "mateIn": eval.mate_in,
                        "depth": eval.depth,
                    });
                    assert_eq!(
                        actual,
                        case.expected,
                        "search_best_move mismatch at line {}",
                        idx + 1
                    );
                }
                "classify_move_delta" => {
                    let actual = serde_json::Value::String(
                        classify_move_delta(
                            case.prev_cp.unwrap_or(0),
                            case.next_cp.unwrap_or(0),
                            case.side.unwrap_or(Side::Black),
                        )
                        .to_string(),
                    );
                    assert_eq!(
                        actual,
                        case.expected,
                        "classify_move_delta mismatch at line {}",
                        idx + 1
                    );
                }
                other => panic!("Unknown recorded fn_name: {other}"),
            }
        }
        assert!(
            count >= 25,
            "Expected at least 25 recorded ground-truth cases, got {count}"
        );
    }
}
