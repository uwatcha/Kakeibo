"""自分のログイン用アカウントを Supabase に作る（新規登録をオフにしても使える管理者 API を使う）

使い方: python3 scripts/create-user.py <メールアドレス>
パスワードは入力時に表示されず、どこにも保存されない。
"""

import getpass
import json
import subprocess
import sys
import urllib.error
import urllib.request

import os
import re
from pathlib import Path


def project_ref() -> str:
    """Supabase のプロジェクトの ref。環境変数 SUPABASE_PROJECT_REF か、.env.local の EXPO_PUBLIC_SUPABASE_URL から読む"""
    if os.environ.get("SUPABASE_PROJECT_REF"):
        return os.environ["SUPABASE_PROJECT_REF"]
    env = Path(__file__).resolve().parent.parent / ".env.local"
    if env.exists():
        m = re.search(r"^EXPO_PUBLIC_SUPABASE_URL=https://([a-z0-9]+)\.supabase\.co", env.read_text(), re.M)
        if m:
            return m.group(1)
    sys.exit("SUPABASE_PROJECT_REF を設定するか、.env.local に EXPO_PUBLIC_SUPABASE_URL を書いてください")


PROJECT_REF = project_ref()
MIN_PASSWORD_LENGTH = 8


def secret_key() -> str:
    out = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", PROJECT_REF, "--output-format", "json", "--reveal"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    data = json.loads(out)
    keys = data if isinstance(data, list) else data.get("keys", data.get("api_keys", []))
    return next(k["api_key"] for k in keys if k.get("type") == "secret")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("使い方: python3 scripts/create-user.py <メールアドレス>")
    email = sys.argv[1]

    password = getpass.getpass("パスワード: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"パスワードは {MIN_PASSWORD_LENGTH} 文字以上にしてください")
    if getpass.getpass("もう一度: ") != password:
        sys.exit("パスワードが一致しません")

    key = secret_key()
    request = urllib.request.Request(
        f"https://{PROJECT_REF}.supabase.co/auth/v1/admin/users",
        data=json.dumps({"email": email, "password": password, "email_confirm": True}).encode(),
        headers={"apikey": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            user = json.load(response)
    except urllib.error.HTTPError as e:
        sys.exit(f"作成できませんでした（{e.code}）: {e.read().decode()}")

    print(f"作成しました: {user['email']}（id: {user['id']}）")


if __name__ == "__main__":
    main()
