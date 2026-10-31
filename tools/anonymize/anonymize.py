#!/usr/bin/env python3
"""顧客から受け取った予約情報・顧客情報（タブ区切り）を匿名化する。

使い方:
  python3 -I tools/anonymize/anonymize.py \
      --customers data/顧客.tsv --reservations data/予約.tsv --out-dir out/

- 2つのファイルを1回で処理する（同じ人に同じ仮名・仮IDを振るため）。片方だけでもよい
- 文字コードは UTF-8（BOM 付き可）か cp932 を自動で判定し、同じ文字コードで書き出す
- 住所は町丁目（「○丁目」）まで残し、番地・号・建物名を消す（--address-level で町名・市区町村までにも絞れる）
- 緯度・経度は丸めたうえで決まった量だけずらす（--coords）。町丁目の代表点にしたいときは drop にしてアプリの住所検索で引き直す
- 見出しが表にない列は空にする（--keep-unknown で残す）
- 対応表（元の値 → 仮の値）は --mapping-out を付けたときだけ書く。元の個人情報を含むので、公開リポジトリに置かない
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import hmac
import json
import math
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

# ---------------------------------------------------------------- 仮名の材料

SURNAMES = [
    ("佐藤", "サトウ"), ("鈴木", "スズキ"), ("高橋", "タカハシ"), ("田中", "タナカ"), ("伊藤", "イトウ"),
    ("渡辺", "ワタナベ"), ("山本", "ヤマモト"), ("中村", "ナカムラ"), ("小林", "コバヤシ"), ("加藤", "カトウ"),
    ("吉田", "ヨシダ"), ("山田", "ヤマダ"), ("佐々木", "ササキ"), ("山口", "ヤマグチ"), ("松本", "マツモト"),
    ("井上", "イノウエ"), ("木村", "キムラ"), ("林", "ハヤシ"), ("斎藤", "サイトウ"), ("清水", "シミズ"),
    ("山崎", "ヤマザキ"), ("森", "モリ"), ("池田", "イケダ"), ("橋本", "ハシモト"), ("阿部", "アベ"),
    ("石川", "イシカワ"), ("山下", "ヤマシタ"), ("中島", "ナカジマ"), ("石井", "イシイ"), ("小川", "オガワ"),
    ("前田", "マエダ"), ("岡田", "オカダ"), ("長谷川", "ハセガワ"), ("藤田", "フジタ"), ("後藤", "ゴトウ"),
    ("近藤", "コンドウ"), ("村上", "ムラカミ"), ("遠藤", "エンドウ"), ("青木", "アオキ"), ("坂本", "サカモト"),
]
GIVEN_NAMES = [
    ("陽子", "ヨウコ"), ("美穂", "ミホ"), ("恵", "メグミ"), ("裕子", "ユウコ"), ("直美", "ナオミ"),
    ("優子", "ユウコ"), ("真由美", "マユミ"), ("智子", "トモコ"), ("由美", "ユミ"), ("美香", "ミカ"),
    ("健", "ケン"), ("誠", "マコト"), ("大輔", "ダイスケ"), ("拓也", "タクヤ"), ("翔太", "ショウタ"),
    ("浩二", "コウジ"), ("隆", "タカシ"), ("和也", "カズヤ"), ("直樹", "ナオキ"), ("剛", "ツヨシ"),
    ("花子", "ハナコ"), ("葵", "アオイ"), ("結衣", "ユイ"), ("さくら", "サクラ"), ("彩", "アヤ"),
    ("蓮", "レン"), ("悠真", "ユウマ"), ("湊", "ミナト"), ("陽翔", "ハルト"), ("颯", "ハヤテ"),
]

# ---------------------------------------------------------------- 住所

_CHOME = re.compile(r"([0-9]+|[〇一二三四五六七八九十]+)丁目")
_KANJI_BANCHI = re.compile(r"[〇一二三四五六七八九十百千]+番")
_SEP = r"[-‐‑–—―ーｰ－の]"
_THREE_PARTS = re.compile(rf"([0-9]+){_SEP}[0-9]+{_SEP}[0-9]+")
# 数字のあとがこれなら町名の一部（北海道の「北1条西」、岩手の「1地割」など）として読み進める
_TOWN_SUFFIX = ("条", "線", "地割", "号線")


def truncate_address(addr: str, level: str = "chome") -> tuple[str, str]:
    """住所を町丁目（chome）・町名（town）・市区町村（city）までに縮める。(縮めた住所, 読めた粒度) を返す。

    粒度は chome（丁目まで残せた）・town（町名まで）・city（市区町村まで）・raw（数字がなく切れなかった）・empty。
    """
    s = unicodedata.normalize("NFKC", addr or "").strip()
    s = re.sub(r"\s+", " ", s)
    if not s:
        return "", "empty"
    postal = re.match(r"^(〒?\s*[0-9]{3}-?[0-9]{4})\s*", s)
    if postal:
        body, lvl = truncate_address(s[postal.end():], level)
        return f"{postal.group(1)} {body}".strip(), lvl
    if level == "city":
        m = re.match(r"^(.+?[都道府県])?([^市区町村]+?郡)?([^市区町村]+?市)?([^市区町村]+?[区町村])?", s)
        cut = m.group(0).strip() if m else ""
        return (cut, "city") if cut else ("", "city")

    m = _CHOME.search(s)
    if m:
        return (s[: m.end()], "chome") if level == "chome" else (s[: m.start()].rstrip(), "town")

    cut_at = None
    for num in re.finditer(r"[0-9]+", s):
        if s[num.end():].startswith(_TOWN_SUFFIX):
            continue
        cut_at = num.start()
        break
    kanji = _KANJI_BANCHI.search(s)
    if kanji and (cut_at is None or kanji.start() < cut_at):
        return s[: kanji.start()].rstrip(), "town"
    if cut_at is None:
        return s, "raw"
    town = s[:cut_at].rstrip()
    three = _THREE_PARTS.match(s[cut_at:])
    if level == "chome" and three:
        # 「1-2-3」の3つ組は 丁目-番-号 と読む
        return f"{town}{three.group(1)}丁目", "chome"
    return town, "town"


# ---------------------------------------------------------------- 緯度・経度

_LATLNG = re.compile(r"(-?[0-9]+(?:\.[0-9]+)?)\s*[,，、/\s]\s*(-?[0-9]+(?:\.[0-9]+)?)")


def blur_latlng(value: str, mode: str, jitter_m: float, salt: bytes, key: str) -> str:
    """緯度・経度を丸めてずらす。区切り文字は元の値のものを使う。読めない値は空にする"""
    s = unicodedata.normalize("NFKC", value or "").strip()
    if not s or mode == "drop":
        return ""
    m = _LATLNG.search(s)
    if not m:
        return ""
    lat, lng = float(m.group(1)), float(m.group(2))
    if mode == "jitter" and jitter_m > 0:
        h = hmac.new(salt, f"latlng:{key}".encode(), hashlib.sha256).digest()
        angle = int.from_bytes(h[:4], "big") / 2**32 * 2 * math.pi
        # 円の中に一様に散らす（半径の下限を半分にして、元の点のすぐ近くに残らないようにする）
        r = jitter_m * math.sqrt(0.25 + 0.75 * int.from_bytes(h[4:8], "big") / 2**32)
        lat += r * math.cos(angle) / 111_320
        lng += r * math.sin(angle) / (111_320 * math.cos(math.radians(lat)))
    sep = s[m.end(1): m.start(2)]
    return f"{lat:.4f}{sep}{lng:.4f}"


# ---------------------------------------------------------------- 仮名・仮IDの割り当て


def _norm_key(v: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", v or ""))


@dataclass
class Pseudonymizer:
    """元の値 → 仮の値。同じ元の値には、どのファイルでも同じ仮の値を返す"""

    salt: bytes
    persons: dict[str, int] = field(default_factory=dict)
    ids: dict[str, dict[str, str]] = field(default_factory=dict)

    def person(self, name_key: str) -> int:
        k = _norm_key(name_key)
        if k not in self.persons:
            self.persons[k] = len(self.persons)
        return self.persons[k]

    def name(self, idx: int) -> tuple[tuple[str, str], tuple[str, str]]:
        # 姓と名の組を重ならないように順に振る（40×30=1200人まで重複なし）
        s = SURNAMES[idx % len(SURNAMES)]
        g = GIVEN_NAMES[(idx // len(SURNAMES) + idx * 7) % len(GIVEN_NAMES)]
        return s, g

    def id(self, kind: str, prefix: str, raw: str) -> str:
        k = _norm_key(raw)
        if not k:
            return ""
        table = self.ids.setdefault(kind, {})
        if k not in table:
            table[k] = f"{prefix}{len(table) + 1:05d}"
        return table[k]


# ---------------------------------------------------------------- 列の扱い

Rule = Callable[[str, "RowCtx"], str]


@dataclass
class RowCtx:
    p: Pseudonymizer
    person: int | None
    args: argparse.Namespace
    stats: dict[str, int]
    row_no: int


def keep(v: str, c: RowCtx) -> str:
    return v


def blank(v: str, c: RowCtx) -> str:
    return ""


def _nonempty(f: Callable[[str, RowCtx], str]) -> Rule:
    return lambda v, c: f(v, c) if (v or "").strip() else ""


def _person_part(pick: Callable[[tuple[tuple[str, str], tuple[str, str]]], str]) -> Rule:
    return _nonempty(lambda v, c: pick(c.p.name(c.person)) if c.person is not None else "")


def _address(v: str, c: RowCtx) -> str:
    out, lvl = truncate_address(v, c.args.address_level)
    c.stats[f"住所:{lvl}"] = c.stats.get(f"住所:{lvl}", 0) + 1
    if lvl == "raw":
        c.stats.setdefault("番地を切れなかった行", []).append(c.row_no)  # type: ignore[union-attr]
        return "" if c.args.drop_unparsed_address else out
    return out


def _latlng(v: str, c: RowCtx) -> str:
    key = f"{c.person}:{v}"
    return blur_latlng(v, c.args.coords, c.args.jitter_m, c.p.salt, key)


def _id(kind: str, prefix: str) -> Rule:
    return lambda v, c: c.p.id(kind, prefix, v)


FULL_NAME = _person_part(lambda n: f"{n[0][0]} {n[1][0]}")
SEI = _person_part(lambda n: n[0][0])
MEI = _person_part(lambda n: n[1][0])
SEI_KANA = _person_part(lambda n: n[0][1])
MEI_KANA = _person_part(lambda n: n[1][1])
CUSTOMER_ID = _id("customer", "C")

RESERVATION_RULES: dict[str, Rule] = {
    "予約番号": _id("reservation", "R"),
    "予約種類": keep,
    "予約日": keep,
    "予約時": keep,
    "所要時間(分)": keep,
    "支払金額（合計）": keep,
    "消費税": keep,
    "メニュー名": keep,
    "オプション": keep,
    "状況": keep,
    "シンプルアンケート": blank,  # 自由記述
    "新規登録者": keep,
    "氏名": FULL_NAME,
    "会員番号": CUSTOMER_ID,
    "住所": _address,
    "住所2[適用開始日YYYY/MM/DD]": keep,
    "住所2[適用終了日YYYY/MM/DD]": keep,
    "住所2": _address,
}

CUSTOMER_RULES: dict[str, Rule] = {
    "顧客ID": CUSTOMER_ID,
    "姓": SEI,
    "名": MEI,
    "姓（カナ）※必須項目": SEI_KANA,
    "名（カナ）※必須項目": MEI_KANA,
    "メールアドレス": _nonempty(lambda v, c: f"user{(c.person or 0) + 1:04d}@example.com"),
    "国番号": keep,
    "電話番号※必須項目": _nonempty(lambda v, c: f"090-0000-{(c.person or 0) + 1:04d}"),
    "会員種別": keep,
    "会員状況（有効／無効）": keep,
    "会費支払方法（現地決済／銀行振込／口座振替／請求書払い）": keep,
    "会費支払状況（未払／支払済み）": keep,
    "パスワード": blank,
    "顧客メモ": blank,  # 自由記述
    "登録日時": keep,
    "最終更新日時": keep,
    "性別": keep,
    "年代": keep,
    "住所": _address,
    "駐車場": keep,
    "駐車場番号・指定場所の詳細など": blank,
    "緊急連絡先": blank,
    "緊急連絡先の方（申請者との関係性）": blank,
    "災害時の避難場所（最寄りの小中学校）": blank,
    "世帯全員の情報（名前・生年月日・職業/所属・アレルギー・その他共有事項）": blank,
    "Benefit会員ID": blank,
    "住所2": _address,
    "住所2[適用開始日YYYY/MM/DD]": keep,
    "住所2[適用終了日YYYY/MM/DD]": keep,
    "緯度・経度": _latlng,
}


# ---------------------------------------------------------------- 読み書き


def read_tsv(path: Path) -> tuple[list[list[str]], str]:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp932"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit(f"{path}: 文字コードを読めない（UTF-8・cp932 以外）")
    rows = list(csv.reader(text.splitlines(keepends=True), delimiter="\t"))
    # 元が BOM 付き UTF-8 なら BOM 付きで書き戻す（Excel で文字化けさせない）
    return rows, ("utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") or enc == "utf-8-sig" else enc)


def write_tsv(path: Path, rows: list[list[str]], enc: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=enc, errors="replace", newline="") as f:
        csv.writer(f, delimiter="\t", lineterminator="\r\n").writerows(rows)


def _person_key(header: list[str], row: list[str], kind: str) -> str:
    def get(col: str) -> str:
        return row[header.index(col)] if col in header and header.index(col) < len(row) else ""

    if kind == "customers":
        return get("姓") + get("名") or "id:" + get("顧客ID")
    return get("氏名") or "id:" + get("会員番号")


def anonymize_rows(
    rows: list[list[str]], rules: dict[str, Rule], kind: str, p: Pseudonymizer, args: argparse.Namespace
) -> tuple[list[list[str]], dict]:
    if not rows:
        return rows, {}
    header = [h.strip() for h in rows[0]]
    stats: dict = {}
    unknown = [h for h in header if h not in rules]
    out = [rows[0]]
    for i, row in enumerate(rows[1:], start=2):
        if not any(cell.strip() for cell in row):
            continue
        key = _person_key(header, row, kind)
        person = p.person(key) if _norm_key(key) not in ("", "id:") else None
        ctx = RowCtx(p, person, args, stats, i)
        new = []
        for col, cell in zip(header, row):
            rule = rules.get(col, keep if args.keep_unknown else blank)
            new.append(rule(cell, ctx))
        out.append(new)
    stats["行数"] = len(out) - 1
    stats["表にない列"] = unknown
    return out, stats


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="予約情報・顧客情報（タブ区切り）を匿名化する")
    ap.add_argument("--customers", type=Path, help="顧客情報のファイル")
    ap.add_argument("--reservations", type=Path, help="予約情報のファイル")
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--address-level", choices=["chome", "town", "city"], default="chome",
                    help="住所をどこまで残すか（既定 chome＝○丁目まで）")
    ap.add_argument("--drop-unparsed-address", action="store_true",
                    help="番地を見つけられなかった住所を空にする（既定は残して件数と行番号を報告）")
    ap.add_argument("--coords", choices=["jitter", "round", "drop"], default="jitter",
                    help="緯度・経度：jitter＝ずらして丸める（既定）・round＝丸めるだけ・drop＝消す")
    ap.add_argument("--jitter-m", type=float, default=200, help="ずらす半径（m。既定 200）")
    ap.add_argument("--salt", default="", help="ずらし方を決める秘密の文字列（同じ値なら同じ結果）")
    ap.add_argument("--keep-unknown", action="store_true", help="表にない列を残す（既定は空にする）")
    ap.add_argument("--mapping-out", type=Path, help="対応表（元の値を含む）を書く先")
    args = ap.parse_args(argv)
    if not args.customers and not args.reservations:
        ap.error("--customers か --reservations のどちらかが要る")
    if args.coords == "round":
        args.jitter_m = 0

    p = Pseudonymizer(salt=(args.salt or "visit-route-demo").encode())
    report = {}
    # 顧客を先に読んで人の番号を振り、予約の氏名と合わせる
    for kind, path, rules in (("customers", args.customers, CUSTOMER_RULES),
                              ("reservations", args.reservations, RESERVATION_RULES)):
        if not path:
            continue
        rows, enc = read_tsv(path)
        out, stats = anonymize_rows(rows, rules, kind, p, args)
        dest = args.out_dir / f"{path.stem}.anon{path.suffix or '.tsv'}"
        write_tsv(dest, out, enc)
        report[str(path)] = {"出力": str(dest), "文字コード": enc, **stats}

    print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)
    if args.mapping_out:
        args.mapping_out.parent.mkdir(parents=True, exist_ok=True)
        args.mapping_out.write_text(
            json.dumps({"persons": p.persons, "ids": p.ids}, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
