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
        self.assertNotIn("架空", c["姓"] + r["氏名"])


if __name__ == "__main__":
    unittest.main()
