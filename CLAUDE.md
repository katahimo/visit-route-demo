# CLAUDE.md

このリポジトリのルールは [AGENTS.md](AGENTS.md) にある。作業前に必ず読む。

- 要件の正：`docs/prd.md`（索引）と `docs/prd/`（テーマ別の要件の表）、設計の正：`docs/design.md`、判断の記録：`docs/adr/`
- 設計の変更・レビュー・作業指示書づくりは `.claude/skills/solo-architecture-design/` の手順に従う
  （`python3 .claude/skills/solo-architecture-design/scripts/check_design.py docs/design.md` で検査）
- 実装は Clean / SOLID の決まり（AGENTS.md「設計・実装の原則」）に従い、`npm run check:code` で新しい違反を出さない
- コメント・ドキュメント・コミットメッセージは日本語
