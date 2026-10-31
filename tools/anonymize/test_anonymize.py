"""anonymize.py のテスト（python3 -m unittest tools/anonymize/test_anonymize.py）。データはすべて架空"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import anonymize as a  # noqa: E402


class TruncateAddress(unittest.TestCase):
    def check(self, src, want, level="chome"):
        self.assertEqual(a.truncate_address(src, level), want)

    def test_丁目の表記はそこまで残す(self):
        self.check("東京都世田谷区三軒茶屋1丁目2番3号 架空ハイツ101", ("東京都世田谷区三軒茶屋1丁目", "chome"))
        self.check("東京都世田谷区三軒茶屋三丁目5-6", ("東京都世田谷区三軒茶屋三丁目", "chome"))

    def test_3つ組は丁目と読む(self):
        self.check("東京都世田谷区三軒茶屋１－２－３　架空ハイツ", ("東京都世田谷区三軒茶屋1丁目", "chome"))
        self.check("神奈川県横浜市中区架空町2-10-5-301", ("神奈川県横浜市中区架空町2丁目", "chome"))

    def test_2つ組と番地は町名まで(self):
        self.check("埼玉県架空市大字架空123-4", ("埼玉県架空市大字架空", "town"))
        self.check("埼玉県架空市大字架空123番地", ("埼玉県架空市大字架空", "town"))
        self.check("長野県架空郡架空村三百番地", ("長野県架空郡架空村", "town"))

    def test_条や地割は町名の一部(self):
        self.check("北海道札幌市中央区北1条西2丁目3-4", ("北海道札幌市中央区北1条西2丁目", "chome"))

    def test_郵便番号は残す(self):
        self.check("〒154-0024 東京都世田谷区三軒茶屋1-2-3", ("〒154-0024 東京都世田谷区三軒茶屋1丁目", "chome"))

    def test_粒度を絞る(self):
        self.check("東京都世田谷区三軒茶屋1-2-3", ("東京都世田谷区三軒茶屋", "town"), "town")
        self.check("東京都世田谷区三軒茶屋1-2-3", ("東京都世田谷区", "city"), "city")
        self.check("神奈川県横浜市中区架空町2-10-5", ("神奈川県横浜市中区", "city"), "city")

    def test_数字がない住所は切れない(self):
        self.check("東京都港区架空ヒルズ", ("東京都港区架空ヒルズ", "raw"))
        self.check("", ("", "empty"))


class BlurLatLng(unittest.TestCase):
    def test_ずらす量は半径の中で決まっている(self):
        out = a.blur_latlng("35.6431, 139.6690", "jitter", 200, b"s", "k")
        self.assertEqual(out, a.blur_latlng("35.6431, 139.6690", "jitter", 200, b"s", "k"))
        lat, lng = (float(x) for x in out.split(","))
        d = ((lat - 35.6431) * 111_320) ** 2 + ((lng - 139.6690) * 111_320 * 0.81) ** 2
        self.assertLess(d ** 0.5, 220)
        self.assertGreater(d ** 0.5, 80)

    def test_丸めと消す(self):
        self.assertEqual(a.blur_latlng("35.643123,139.669012", "round", 0, b"s", "k"), "35.6431,139.6690")
        self.assertEqual(a.blur_latlng("35.6,139.6", "drop", 0, b"s", "k"), "")
        self.assertEqual(a.blur_latlng("不明", "jitter", 200, b"s", "k"), "")


class PseudoName(unittest.TestCase):
    def test_性別に合わせて歴史上の人物から順に振る(self):
        p = a.Pseudonymizer(b"s")
        m = p.person("甲", "M")
        f = p.person("乙", "F")
        self.assertEqual(p.name(m), (("織田", "オダ"), ("信長", "ノブナガ")))
        self.assertEqual(p.name(f), (("北条", "ホウジョウ"), ("政子", "マサコ")))
        self.assertEqual(p.name(m), p.name(m))

    def test_性別が分からない人は男女交互(self):
        p = a.Pseudonymizer(b"s")
        got = [p.name(p.person(f"x{i}")) for i in range(4)]
        self.assertEqual([g[1][0] for g in got], ["信長", "政子", "秀吉", "式部"])

    def test_性別の値(self):
        self.assertEqual([a.gender_of(v) for v in ("男", "女", "男性", "その他", "")], ["M", "F", "M", None, None])

    def test_使い切っても重ならない(self):
        for g, seq in a.NAME_SEQUENCE.items():
            self.assertEqual(len(set(seq)), len(seq))
            self.assertGreater(len(seq), 2000)
        self.assertFalse(set(a.NAME_SEQUENCE["M"]) & set(a.NAME_SEQUENCE["F"]))

    def test_使い切るまでは実在の組(self):
        seq = a.NAME_SEQUENCE["F"]
        n = len(a._WOMEN)
        for s, g in seq[:n]:
            self.assertIn((s[0], g[0]), a._REAL)
        for s, g in seq[n:n + 300]:
            self.assertNotIn((s[0], g[0]), a._REAL)

    def test_スタッフ名は同じ人に同じ仮名で顧客とは重ならない(self):
        p = a.Pseudonymizer(b"s")
        c = a.RowCtx(p, p.person("顧客"), None, {}, 1)
        s1 = a.STAFF_NAME("山田花子", c)
        self.assertEqual(s1, a.STAFF_NAME("山田花子", c))
        self.assertNotEqual(s1, a.STAFF_NAME("鈴木一郎", c))
        self.assertNotEqual(s1, a.FULL_NAME("顧客", c))
        self.assertEqual(a.STAFF_NAME("", c), "")
        self.assertEqual(a.STAFF_NAME("-", c), "-")

    def test_実在の組は重複がない(self):
        self.assertEqual(len(a._REAL), len(a._MEN) + len(a._WOMEN))


class EndToEnd(unittest.TestCase):
    def test_顧客と予約で同じ人に同じ仮名とIDを振る(self):
        cust_header = list(a.CUSTOMER_RULES)
        res_header = list(a.RESERVATION_RULES)
        cust = {h: "" for h in cust_header} | {
            "顧客ID": "9001", "姓": "架空", "名": "太郎", "メールアドレス": "taro@example.org",
            "電話番号※必須項目": "09012345678", "パスワード": "secret", "顧客メモ": "鍵はポスト",
            "住所": "東京都世田谷区三軒茶屋1-2-3", "緯度・経度": "35.6431,139.6690", "性別": "男性",
        }
        res = {h: "" for h in res_header} | {
            "予約番号": "A-77", "予約日": "2026/10/01", "氏名": "架空 太郎", "会員番号": "9001",
            "住所": "東京都世田谷区三軒茶屋1丁目2番3号", "シンプルアンケート": "犬がいます",
        }
        with tempfile.TemporaryDirectory() as d:
            dp = Path(d)
            (dp / "c.tsv").write_bytes(("\t".join(cust_header) + "\r\n" + "\t".join(cust.values()) + "\r\n").encode("cp932"))
            (dp / "r.tsv").write_text("\t".join(res_header) + "\n" + "\t".join(res.values()) + "\n", encoding="utf-8-sig")
            a.main(["--customers", str(dp / "c.tsv"), "--reservations", str(dp / "r.tsv"), "--out-dir", str(dp / "out")])
            c_rows, c_enc = a.read_tsv(dp / "out" / "c.anon.tsv")
            r_rows, r_enc = a.read_tsv(dp / "out" / "r.anon.tsv")
        self.assertEqual((c_enc, r_enc), ("cp932", "utf-8-sig"))
        c = dict(zip(c_rows[0], c_rows[1]))
        r = dict(zip(r_rows[0], r_rows[1]))
        self.assertEqual(r["氏名"], f"{c['姓']} {c['名']}")
        self.assertEqual(r["会員番号"], c["顧客ID"])
        self.assertEqual(c["顧客ID"], "C00001")
        self.assertEqual(r["予約番号"], "R00001")
        self.assertEqual(c["住所"], "東京都世田谷区三軒茶屋1丁目")
        self.assertEqual(r["住所"], "東京都世田谷区三軒茶屋1丁目")
        self.assertEqual(c["メールアドレス"], "user0001@example.com")
        self.assertEqual(c["電話番号※必須項目"], "090-0000-0001")
        self.assertEqual((c["パスワード"], c["顧客メモ"], r["シンプルアンケート"]), ("", "", ""))
        self.assertEqual((c["性別"], r["予約日"]), ("男性", "2026/10/01"))
        self.assertEqual((c["姓"], c["名"]), ("織田", "信長"))


class Staff(unittest.TestCase):
    def test_カンマ区切りのスタッフ表を匿名化し予約の新規登録者と同じ仮名にする(self):
        staff_header = list(a.STAFF_RULES)
        st = {h: "" for h in staff_header} | {
            "ID": "S022", "氏名": "くろまめ", "TEL": "0221234567", "mail address": "kuro@example.org",
            "緯度・経度": "38.2564, 140.8761", "退職日": "2026.3.31", "ユーザーID": "kuromame",
            "パスワード(暗号化)": "f6b7", "管理者": "1", "LW_ID": "cu.1@x",
            "都度更新ユーザ識別(SessionToken)": "tok", "識別符号期限(SessionExpiry)": "2026/02/04 22:10:20",
        }
        res_header = list(a.RESERVATION_RULES)
        res = {h: "" for h in res_header} | {"予約番号": "A-1", "新規登録者": "くろまめ"}
        with tempfile.TemporaryDirectory() as d:
            dp = Path(d)
            (dp / "s.csv").write_text(",".join(staff_header) + "\n" + ",".join(f'"{v}"' for v in st.values()) + "\n", encoding="utf-8")
            (dp / "r.tsv").write_text("\t".join(res_header) + "\n" + "\t".join(res.values()) + "\n", encoding="utf-8-sig")
            a.main(["--staff", str(dp / "s.csv"), "--reservations", str(dp / "r.tsv"), "--out-dir", str(dp / "out")])
            s_rows, _, delim = a.read_table(dp / "out" / "s.anon.csv")
            r_rows, _ = a.read_tsv(dp / "out" / "r.anon.tsv")
        self.assertEqual(delim, ",")
        s_ = dict(zip(s_rows[0], s_rows[1]))
        r = dict(zip(r_rows[0], r_rows[1]))
        self.assertEqual(s_["氏名"], "北条 政子")
        self.assertEqual((s_rows[0][-1], s_["性別"]), ("性別", "女"))
        self.assertEqual(r["新規登録者"], s_["氏名"])
        self.assertEqual((s_["ID"], s_["mail address"], s_["ユーザーID"]), ("S00001", "staff0001@example.com", "staff0001"))
        self.assertEqual(s_["TEL"], "080-0000-0001")
        for col in ("パスワード(暗号化)", "LW_ID", "都度更新ユーザ識別(SessionToken)", "識別符号期限(SessionExpiry)"):
            self.assertEqual(s_[col], "")
        self.assertEqual((s_["管理者"], s_["退職日"]), ("1", "2026.3.31"))


if __name__ == "__main__":
    unittest.main()
