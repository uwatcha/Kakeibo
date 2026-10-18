"""使用感を確かめるためのダミーデータを自分のアカウントに入れる / 消す

使い方:
  python3 scripts/seed-dummy.py <メールアドレス>                  # 入れる
  python3 scripts/seed-dummy.py <メールアドレス> --delete         # 入れたものだけ消す
  python3 scripts/seed-dummy.py <メールアドレス> --add-employers  # 入れ済みのダミーに働き先だけ足す

入れた口座・記録の id は scripts/.dummy-data.json に残し、--delete ではそれだけを消す。
既存の口座「財布」があれば現金の記録にはそれを使う（口座自体は消さない）。
"""

import importlib.util
import json
import random
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE_FILE = HERE / ".dummy-data.json"
START = date(2026, 8, 1)
TODAY = date(2026, 10, 18)

spec = importlib.util.spec_from_file_location("create_user", HERE / "create-user.py")
create_user = importlib.util.module_from_spec(spec)
spec.loader.exec_module(create_user)
BASE = f"https://{create_user.PROJECT_REF}.supabase.co"
KEY = create_user.secret_key()  # RLS を通らないので user_id は必ず明示する


def call(method: str, path: str, body=None, prefer: str | None = None):
    headers = {"apikey": KEY, "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            text = response.read()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} に失敗しました（{e.code}）: {e.read().decode()}")


def find_user_id(email: str) -> str:
    users = call("GET", "/auth/v1/admin/users")["users"]
    user = next((u for u in users if u["email"] == email), None)
    if not user:
        sys.exit(f"{email} のユーザーが見つかりません")
    return user["id"]


def delete(user_id: str) -> None:
    if not STATE_FILE.exists():
        sys.exit("ダミーデータの記録（scripts/.dummy-data.json）がありません")
    state = json.loads(STATE_FILE.read_text())
    ids = lambda xs: urllib.parse.quote(f"in.({','.join(xs)})")  # noqa: E731
    for chunk in range(0, len(state["transactions"]), 100):
        part = state["transactions"][chunk : chunk + 100]
        call("DELETE", f"/rest/v1/transactions?user_id=eq.{user_id}&id={ids(part)}")
    if state["accounts"]:
        call("DELETE", f"/rest/v1/accounts?user_id=eq.{user_id}&id={ids(state['accounts'])}")
    if state.get("employers"):
        call("DELETE", f"/rest/v1/employers?user_id=eq.{user_id}&id={ids(state['employers'])}")
    STATE_FILE.unlink()
    print(
        f"消しました: 記録 {len(state['transactions'])} 件、口座 {len(state['accounts'])} 件、"
        f"働き先 {len(state.get('employers', []))} 件"
    )


def create_employers(user_id: str) -> list[str]:
    """ダミーのバイト代（毎月25日）に合わせた働き先"""
    rows = [{"user_id": user_id, "name": "バイト先", "payday": 25, "payday_shift": "before", "sort_order": 10}]
    return [e["id"] for e in call("POST", "/rest/v1/employers", rows, prefer="return=representation")]


def check_balances(created: list[dict], wallet: dict | None, txns: list[dict], acc: dict[str, str]) -> bool:
    """日付順に残高を追い、財布・銀行・Suica が途中でマイナスにならないか確かめる"""
    balance = {a["id"]: a["opening_balance"] for a in created}
    if wallet:
        balance[wallet["id"]] = call("GET", f"/rest/v1/accounts?id=eq.{wallet['id']}&select=opening_balance")[0]["opening_balance"]
    watch = {acc[n]: n for n in ("財布", "三井住友銀行", "Suica")}
    lowest = {n: (balance[i], "") for i, n in watch.items()}
    for t in sorted(txns, key=lambda t: (t["date"], t["to_account_id"] is None)):
        if t["from_account_id"]:
            balance[t["from_account_id"]] -= t["amount"]
        if t["to_account_id"]:
            balance[t["to_account_id"]] += t["amount"]
        for i, n in watch.items():
            if balance[i] < lowest[n][0]:
                lowest[n] = (balance[i], t["date"])
    names = {v: k for k, v in acc.items()}
    print("最終残高:", {names[i]: b for i, b in balance.items() if i in names})
    print("途中の最低残高:", lowest)
    return all(v >= 0 for v, _ in lowest.values())


def seed(user_id: str) -> None:
    if STATE_FILE.exists():
        sys.exit("すでにダミーデータが入っています。入れ直すなら先に --delete してください")
    rng = random.Random(20261018)

    existing = call("GET", f"/rest/v1/accounts?user_id=eq.{user_id}&select=id,name,kind,sort_order")
    wallet = next((a for a in existing if a["kind"] == "cash" and a["name"] == "財布"), None)
    max_order = max([a["sort_order"] for a in existing] or [0])

    new_accounts = [
        ("三井住友銀行", "bank", 180000, False),
        ("Suica", "emoney", 1500, False),
        ("サンプルカード", "credit_card", -12000, False),
        ("NISA", "investment", 300000, True),
        ("貯金箱", "cash", 23000, True),
        ("親", "payable", 0, False),
        ("友人A", "receivable", 0, False),
    ]
    if not wallet:
        new_accounts.insert(0, ("財布", "cash", 5000, False))
    rows = [
        {
            "user_id": user_id,
            "name": name,
            "kind": kind,
            "opening_balance": opening,
            "is_reserved": reserved,
            "sort_order": max_order + (i + 1) * 10,
        }
        for i, (name, kind, opening, reserved) in enumerate(new_accounts)
    ]
    created = call("POST", "/rest/v1/accounts", rows, prefer="return=representation")
    acc = {a["name"]: a["id"] for a in created}
    if wallet:
        acc["財布"] = wallet["id"]

    categories = call("GET", f"/rest/v1/categories?user_id=eq.{user_id}&select=id,name,parent_id")
    cat = {c["name"]: c["id"] for c in categories}

    txns: list[dict] = []

    def add(type_, day, amount, frm=None, to=None, category=None, memo=None):
        if day > TODAY:
            return
        txns.append(
            {
                "user_id": user_id,
                "type": type_,
                "date": day.isoformat(),
                "amount": int(amount),
                "from_account_id": acc[frm] if frm else None,
                "to_account_id": acc[to] if to else None,
                "category_id": cat[category] if category else None,
                "payee": memo,
            }
        )

    def round10(x: float) -> int:
        return int(round(x / 10) * 10)

    card_usage: dict[tuple[int, int], int] = {}

    def card_expense(day, amount, category, memo):
        add("expense", day, amount, frm="サンプルカード", category=category, memo=memo)
        if day <= TODAY:
            key = (day.year, day.month)
            card_usage[key] = card_usage.get(key, 0) + int(amount)

    months = [(2026, 8), (2026, 9), (2026, 10)]
    for year, month in months:
        d = lambda n: date(year, month, n)  # noqa: E731
        # 収入
        add("income", d(1), 50000, to="三井住友銀行", category="仕送り", memo="仕送り")
        add("income", d(25), round10(rng.uniform(52000, 68000)), to="三井住友銀行", category="給与・アルバイト", memo="バイト代")
        # 固定費
        add("expense", d(27), 45000, frm="三井住友銀行", category="住居", memo="家賃")
        card_expense(d(12), round10(rng.uniform(5200, 7800)), "水道光熱", "電気・ガス")
        card_expense(d(15), 2980, "通信", "スマホ代")
        card_expense(d(20), 980, "趣味・娯楽", "動画配信サブスク")
        # ATM・チャージ
        for n in (3, 17):
            add("transfer", d(n), 15000, frm="三井住友銀行", to="財布", memo="ATM")
        for n in (5, 19):
            add("transfer", d(n), 3000, frm="三井住友銀行", to="Suica", memo="チャージ")

        last_day = (date(year + month // 12, month % 12 + 1, 1) - timedelta(days=1)).day
        for n in range(1, last_day + 1):
            day = d(n)
            weekday = day.weekday()
            # 自炊の買い出し（週3回くらい）
            if weekday in (0, 3, 5):
                amount = round10(rng.uniform(900, 3200))
                if rng.random() < 0.5:
                    add("expense", day, amount, frm="財布", category="自炊", memo=rng.choice(["スーパー", "業務スーパー"]))
                else:
                    card_expense(day, amount, "自炊", "スーパー")
            # 平日の昼食
            if weekday < 5 and rng.random() < 0.45:
                add("expense", day, round10(rng.uniform(450, 950)), frm="財布", category="外食", memo=rng.choice(["学食", "定食屋", "ラーメン"]))
            # カフェ・間食
            if rng.random() < 0.25:
                add("expense", day, round10(rng.uniform(150, 650)), frm="Suica", category="カフェ / 間食", memo=rng.choice(["コンビニ", "カフェ"]))
            # 交通
            if weekday < 5 and rng.random() < 0.35:
                add("expense", day, rng.choice([168, 178, 220, 336]), frm="Suica", category="交通", memo="電車")
        # 月ごとのばらつき
        add("expense", d(rng.randint(2, 9)), round10(rng.uniform(800, 2200)), frm="財布", category="日用品", memo="ドラッグストア")
        card_expense(d(rng.randint(10, 16)), round10(rng.uniform(600, 1800)), "日用品", "ネット通販")
        card_expense(d(rng.randint(6, 14)), round10(rng.uniform(1500, 4500)), "趣味・娯楽", rng.choice(["映画", "ゲーム", "本"]))
        add("expense", d(rng.randint(1, 18)), round10(rng.uniform(1200, 3000)), frm="財布", category="学び", memo="参考書")

    # 9月: 服、病院、特別な出費、飲み会の割り勘（クレカでまとめて払い、友人の分は立て替え）
    card_expense(date(2026, 9, 7), 6990, "衣服・美容", "服")
    add("expense", date(2026, 9, 10), 1880, frm="財布", category="医療", memo="病院")
    card_expense(date(2026, 9, 21), 4200, "交際", "飲み会（自分の分）")
    add("advance", date(2026, 9, 21), 4200, frm="サンプルカード", to="友人A", memo="飲み会（友人Aの分）")
    card_usage[(2026, 9)] = card_usage.get((2026, 9), 0) + 4200
    add("collect", date(2026, 9, 24), 4200, frm="友人A", to="財布", memo="飲み会の立て替え分")
    # 8月: 帰省の交通費、親からの借金
    card_expense(date(2026, 8, 11), 14800, "特別な出費", "帰省の新幹線")
    add("borrow", date(2026, 8, 13), 30000, frm="親", to="三井住友銀行", memo="教科書代を借りた")
    add("repay", date(2026, 9, 26), 10000, frm="三井住友銀行", to="親", memo="返済1回目")
    # 10月: 友人に貸す（まだ返ってきていない）、美容院、財布の残高調整
    add("lend", date(2026, 10, 9), 3000, frm="財布", to="友人A", memo="立て替えではなく貸した")
    add("expense", date(2026, 10, 11), 4400, frm="財布", category="衣服・美容", memo="美容院")
    add("adjustment", date(2026, 10, 15), 120, frm="財布", memo="小銭のずれを修正")
    add("expense", date(2026, 10, 16), 3000, frm="財布", memo="未分類の支払い")

    # クレカ引き落とし: 毎月27日に前月の利用分（8月は使い始めの未払い 12,000円）。全部の利用を入れてから計算する
    for year, month in months:
        bill = 12000 if month == 8 else card_usage.get((year, month - 1), 0)
        add("transfer", date(year, month, 27), bill, frm="三井住友銀行", to="サンプルカード", memo="カード引き落とし")

    if not check_balances(created, wallet, txns, acc):
        ids = urllib.parse.quote(f"in.({','.join(a['id'] for a in created)})")
        call("DELETE", f"/rest/v1/accounts?user_id=eq.{user_id}&id={ids}")
        sys.exit("残高がマイナスになる口座があるので中止しました（作った口座は消しました）")
    created_txns = call("POST", "/rest/v1/transactions", txns, prefer="return=representation")
    employer_ids = create_employers(user_id)
    STATE_FILE.write_text(
        json.dumps(
            {
                "accounts": [a["id"] for a in created],
                "transactions": [t["id"] for t in created_txns],
                "employers": employer_ids,
            },
            indent=2,
        )
    )
    print(f"入れました: 口座 {len(created)} 件、記録 {len(created_txns)} 件（{START} 〜 {TODAY}）")


def main() -> None:
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in ("--delete", "--add-employers")):
        sys.exit("使い方: python3 scripts/seed-dummy.py <メールアドレス> [--delete | --add-employers]")
    user_id = find_user_id(sys.argv[1])
    if len(sys.argv) == 3 and sys.argv[2] == "--delete":
        delete(user_id)
    elif len(sys.argv) == 3:
        state = json.loads(STATE_FILE.read_text())
        if state.get("employers"):
            sys.exit("働き先はすでに入っています")
        state["employers"] = create_employers(user_id)
        STATE_FILE.write_text(json.dumps(state, indent=2))
        print("働き先を足しました")
    else:
        seed(user_id)


if __name__ == "__main__":
    main()
