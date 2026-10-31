#!/usr/bin/env python3
"""顧客から受け取った予約情報・顧客情報（タブ区切り）を匿名化する。

使い方:
  python3 -I tools/anonymize/anonymize.py \
      --customers data/顧客.tsv --reservations data/予約.tsv --staff data/スタッフ.csv --out-dir out/

- 2つのファイルを1回で処理する（同じ人に同じ仮名・仮IDを振るため）。片方だけでもよい
- 文字コードは UTF-8（BOM 付き可）・UTF-16（BOM 付き）・cp932 を自動で判定し、同じ文字コードで書き出す
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

# 江戸時代以前の歴史上の人物（皇族を除く）。(姓, セイ, 名, メイ)。ひとめで架空と分かるよう、実在の顧客に似せない
FIGURES = [
    ("織田", "オダ", "信長", "ノブナガ"), ("豊臣", "トヨトミ", "秀吉", "ヒデヨシ"), ("徳川", "トクガワ", "家康", "イエヤス"),
    ("武田", "タケダ", "信玄", "シンゲン"), ("上杉", "ウエスギ", "謙信", "ケンシン"), ("伊達", "ダテ", "政宗", "マサムネ"),
    ("真田", "サナダ", "幸村", "ユキムラ"), ("明智", "アケチ", "光秀", "ミツヒデ"), ("石田", "イシダ", "三成", "ミツナリ"),
    ("前田", "マエダ", "利家", "トシイエ"), ("毛利", "モウリ", "元就", "モトナリ"), ("今川", "イマガワ", "義元", "ヨシモト"),
    ("北条", "ホウジョウ", "氏康", "ウジヤス"), ("長宗我部", "チョウソカベ", "元親", "モトチカ"), ("島津", "シマヅ", "義弘", "ヨシヒロ"),
    ("黒田", "クロダ", "官兵衛", "カンベエ"), ("竹中", "タケナカ", "半兵衛", "ハンベエ"), ("加藤", "カトウ", "清正", "キヨマサ"),
    ("福島", "フクシマ", "正則", "マサノリ"), ("本多", "ホンダ", "忠勝", "タダカツ"), ("井伊", "イイ", "直政", "ナオマサ"),
    ("榊原", "サカキバラ", "康政", "ヤスマサ"), ("柴田", "シバタ", "勝家", "カツイエ"), ("丹羽", "ニワ", "長秀", "ナガヒデ"),
    ("滝川", "タキガワ", "一益", "カズマス"), ("森", "モリ", "蘭丸", "ランマル"), ("浅井", "アザイ", "長政", "ナガマサ"),
    ("朝倉", "アサクラ", "義景", "ヨシカゲ"), ("斎藤", "サイトウ", "道三", "ドウサン"), ("松永", "マツナガ", "久秀", "ヒサヒデ"),
    ("大友", "オオトモ", "宗麟", "ソウリン"), ("龍造寺", "リュウゾウジ", "隆信", "タカノブ"), ("最上", "モガミ", "義光", "ヨシアキ"),
    ("蒲生", "ガモウ", "氏郷", "ウジサト"), ("直江", "ナオエ", "兼続", "カネツグ"), ("片倉", "カタクラ", "小十郎", "コジュウロウ"),
    ("山内", "ヤマウチ", "一豊", "カズトヨ"), ("藤堂", "トウドウ", "高虎", "タカトラ"), ("小早川", "コバヤカワ", "秀秋", "ヒデアキ"),
    ("宇喜多", "ウキタ", "秀家", "ヒデイエ"), ("大谷", "オオタニ", "吉継", "ヨシツグ"), ("後藤", "ゴトウ", "又兵衛", "マタベエ"),
    ("宮本", "ミヤモト", "武蔵", "ムサシ"), ("佐々木", "ササキ", "小次郎", "コジロウ"), ("柳生", "ヤギュウ", "宗矩", "ムネノリ"),
    ("千", "セン", "利休", "リキュウ"), ("山本", "ヤマモト", "勘助", "カンスケ"), ("雑賀", "サイカ", "孫一", "マゴイチ"),
    ("服部", "ハットリ", "半蔵", "ハンゾウ"), ("石川", "イシカワ", "五右衛門", "ゴエモン"), ("酒井", "サカイ", "忠次", "タダツグ"),
    ("源", "ミナモト", "頼朝", "ヨリトモ"), ("源", "ミナモト", "義経", "ヨシツネ"), ("平", "タイラ", "清盛", "キヨモリ"),
    ("木曽", "キソ", "義仲", "ヨシナカ"), ("北条", "ホウジョウ", "時宗", "トキムネ"), ("北条", "ホウジョウ", "政子", "マサコ"),
    ("足利", "アシカガ", "尊氏", "タカウジ"), ("足利", "アシカガ", "義満", "ヨシミツ"), ("楠木", "クスノキ", "正成", "マサシゲ"),
    ("新田", "ニッタ", "義貞", "ヨシサダ"), ("武蔵坊", "ムサシボウ", "弁慶", "ベンケイ"), ("那須", "ナス", "与一", "ヨイチ"),
    ("平", "タイラ", "将門", "マサカド"), ("藤原", "フジワラ", "道長", "ミチナガ"), ("藤原", "フジワラ", "鎌足", "カマタリ"),
    ("蘇我", "ソガ", "馬子", "ウマコ"), ("安倍", "アベ", "晴明", "セイメイ"), ("坂上", "サカノウエ", "田村麻呂", "タムラマロ"),
    ("菅原", "スガワラ", "道真", "ミチザネ"), ("小野", "オノ", "小町", "コマチ"), ("日野", "ヒノ", "富子", "トミコ"),
    ("細川", "ホソカワ", "勝元", "カツモト"), ("山名", "ヤマナ", "宗全", "ソウゼン"), ("太田", "オオタ", "道灌", "ドウカン"),
    ("徳川", "トクガワ", "秀忠", "ヒデタダ"), ("徳川", "トクガワ", "吉宗", "ヨシムネ"), ("徳川", "トクガワ", "光圀", "ミツクニ"),
    ("大岡", "オオオカ", "忠相", "タダスケ"), ("松平", "マツダイラ", "定信", "サダノブ"), ("田沼", "タヌマ", "意次", "オキツグ"),
    ("保科", "ホシナ", "正之", "マサユキ"), ("水野", "ミズノ", "忠邦", "タダクニ"), ("松尾", "マツオ", "芭蕉", "バショウ"),
    ("近松", "チカマツ", "門左衛門", "モンザエモン"), ("井原", "イハラ", "西鶴", "サイカク"), ("葛飾", "カツシカ", "北斎", "ホクサイ"),
    ("歌川", "ウタガワ", "広重", "ヒロシゲ"), ("伊能", "イノウ", "忠敬", "タダタカ"), ("杉田", "スギタ", "玄白", "ゲンパク"),
    ("平賀", "ヒラガ", "源内", "ゲンナイ"), ("二宮", "ニノミヤ", "尊徳", "ソントク"), ("大石", "オオイシ", "内蔵助", "クラノスケ"),
    ("浅野", "アサノ", "長矩", "ナガノリ"), ("天草", "アマクサ", "四郎", "シロウ"), ("由井", "ユイ", "正雪", "ショウセツ"),
    ("間宮", "マミヤ", "林蔵", "リンゾウ"), ("緒方", "オガタ", "洪庵", "コウアン"),
]
_REAL = {(s, g) for s, _, g, _ in FIGURES}
# 実在の組を使い切ったあとは、同じ材料の姓と名を組み替える（徳川 信長、織田 家康など。これも一目で架空と分かる）
_SURNAMES = list(dict.fromkeys((s, sk) for s, sk, _, _ in FIGURES))
_GIVENS = list(dict.fromkeys((g, gk) for _, _, g, gk in FIGURES))
_MIXED = [(s, g) for g in _GIVENS for s in _SURNAMES if (s[0], g[0]) not in _REAL]

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
        # 歴史上の人物を順に振り、使い切ったら姓と名を組み替える（組み替えで重複なしに何千人も振れる）
        if idx < len(FIGURES):
            s, sk, g, gk = FIGURES[idx]
            return (s, sk), (g, gk)
        return _MIXED[(idx - len(FIGURES)) % len(_MIXED)]

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
# スタッフ名：顧客と同じ表から振るので顧客の仮名と重ならない。同じスタッフには同じ仮名。「-」は担当なしの印なので残す
STAFF_NAME = _nonempty(lambda v, c: v if v.strip() in ("-", "－", "ー") else
                       "{} {}".format(*(x[0] for x in c.p.name(c.p.person("staff:" + v)))))

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
    "新規登録者": STAFF_NAME,  # スタッフの名前
    "氏名": FULL_NAME,
    "会員番号": CUSTOMER_ID,
    "住所": _address,
    "住所2[適用開始日YYYY/MM/DD]": keep,
    "住所2[適用終了日YYYY/MM/DD]": keep,
    "住所2": _address,
}

STAFF_RULES: dict[str, Rule] = {
    "ID": _id("staff", "S"),
    "氏名": STAFF_NAME,
    "住所": blank,
    "TEL": _nonempty(lambda v, c: f"080-0000-{(c.person or 0) + 1:04d}"),
    "mail address": _nonempty(lambda v, c: f"staff{(c.person or 0) + 1:04d}@example.com"),
    "緯度・経度": _latlng,
    "入社日": keep,
    "退職日": keep,
    "ユーザーID": _nonempty(lambda v, c: f"staff{(c.person or 0) + 1:04d}"),
    "パスワード(暗号化)": blank,
    "管理者": keep,
    "LW_ID": blank,  # 外部サービスの ID
    "GoogleChatID": blank,
    "都度更新ユーザ識別(SessionToken)": blank,
    "識別符号期限(SessionExpiry)": blank,
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
    rows, enc, _ = read_table(path)
    return rows, enc


def read_table(path: Path) -> tuple[list[list[str]], str, str]:
    """(行, 文字コード, 区切り文字)。区切りは見出し行のタブとカンマの多いほう（スタッフ表はカンマ区切り）"""
    raw = path.read_bytes()
    # UTF-16 は BOM があるときだけ（BOM なしの cp932 を誤判定しない）
    encs = ("utf-16", "utf-8-sig", "cp932") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else ("utf-8-sig", "cp932")
    for enc in encs:
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit(f"{path}: 文字コードを読めない（UTF-8・UTF-16（BOM 付き）・cp932 以外）")
    first = text.lstrip("﻿").split("\n", 1)[0]
    delim = "," if first.count(",") > first.count("\t") else "\t"
    rows = list(csv.reader(text.splitlines(keepends=True), delimiter=delim))
    # 元が BOM 付き UTF-8 なら BOM 付きで書き戻す（Excel で文字化けさせない）
    return rows, ("utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") or enc == "utf-8-sig" else enc), delim


def write_tsv(path: Path, rows: list[list[str]], enc: str, delim: str = "\t") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=enc, errors="replace", newline="") as f:
        csv.writer(f, delimiter=delim, lineterminator="\r\n").writerows(rows)


def _person_key(header: list[str], row: list[str], kind: str) -> str:
    def get(col: str) -> str:
        return row[header.index(col)] if col in header and header.index(col) < len(row) else ""

    if kind == "staff":
        return "staff:" + get("氏名") if get("氏名").strip() else ""
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
        person = p.person(key) if _norm_key(key) not in ("", "id:", "staff:") else None
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
    ap = argparse.ArgumentParser(description="予約情報・顧客情報（タブ区切り）・スタッフ情報（カンマ区切り）を匿名化する")
    ap.add_argument("--customers", type=Path, help="顧客情報のファイル")
    ap.add_argument("--reservations", type=Path, help="予約情報のファイル")
    ap.add_argument("--staff", type=Path, help="スタッフ情報のファイル（予約の新規登録者と同じ人に同じ仮名を振る）")
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
    if not (args.customers or args.reservations or args.staff):
        ap.error("--customers・--reservations・--staff のどれかが要る")
    if args.coords == "round":
        args.jitter_m = 0

    p = Pseudonymizer(salt=(args.salt or "visit-route-demo").encode())
    report = {}
    # スタッフ・顧客を先に読んで人の番号を振り、予約の新規登録者・氏名と合わせる
    for kind, path, rules in (("staff", args.staff, STAFF_RULES),
                              ("customers", args.customers, CUSTOMER_RULES),
                              ("reservations", args.reservations, RESERVATION_RULES)):
        if not path:
            continue
        rows, enc, delim = read_table(path)
        out, stats = anonymize_rows(rows, rules, kind, p, args)
        dest = args.out_dir / f"{path.stem}.anon{path.suffix or '.tsv'}"
        write_tsv(dest, out, enc, delim)
        report[str(path)] = {"出力": str(dest), "文字コード": enc, **stats}

    print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)
    if args.mapping_out:
        args.mapping_out.parent.mkdir(parents=True, exist_ok=True)
        args.mapping_out.write_text(
            json.dumps({"persons": p.persons, "ids": p.ids}, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
