import re
from pathlib import Path


def tokenize_basic(code):
    """简单的分词：返回 (类型, 字符, 位置) 列表，跳过字符串、注释、正则。"""
    tokens = []
    i = 0
    n = len(code)
    while i < n:
        ch = code[i]

        # 跳过行注释
        if ch == '/' and i + 1 < n and code[i + 1] == '/':
            while i < n and code[i] != '\n':
                i += 1
            continue

        # 跳过块注释
        if ch == '/' and i + 1 < n and code[i + 1] == '*':
            i += 2
            while i < n - 1 and not (code[i] == '*' and code[i + 1] == '/'):
                i += 1
            i += 2
            continue

        # 跳过字符串
        if ch in ('"', "'", '`'):
            quote = ch
            i += 1
            while i < n:
                if code[i] == '\\':
                    i += 2
                    continue
                if code[i] == quote:
                    i += 1
                    break
                i += 1
            continue

        # 跳过正则表达式 /.../ (简化处理：只要 / 前面是可能开始正则的 token 就视为正则)
        if ch == '/':
            prev = None
            j = i - 1
            while j >= 0 and code[j] in ' \t\n\r':
                j -= 1
            if j >= 0:
                prev = code[j]
            # 前面是这些字符之一时，更可能是正则开始
            regex_prev = '=,;:(![{&|^~*?/>+-'
            if prev is None or prev in regex_prev:
                i += 1
                while i < n:
                    if code[i] == '\\':
                        i += 2
                        continue
                    if code[i] == '/':
                        # 跳过 flags
                        i += 1
                        while i < n and code[i] in 'gimuy':
                            i += 1
                        break
                    i += 1
                continue

        tokens.append((ch, i))
        i += 1
    return tokens


def check_brackets(code):
    tokens = tokenize_basic(code)
    stack = []
    pairs = {'(': ')', '[': ']', '{': '}'}

    for ch, i in tokens:
        if ch in pairs:
            stack.append((ch, i))
        elif ch in pairs.values():
            if not stack:
                return False, i, f"Unexpected {ch}"
            opener, pos = stack.pop()
            if pairs[opener] != ch:
                return False, i, f"Mismatched {opener} at {pos} and {ch}"

    if stack:
        opener, pos = stack[-1]
        return False, pos, f"Unclosed {opener}"
    return True, -1, "OK"


def main():
    import sys
    files = sys.argv[1:] if len(sys.argv) > 1 else ['static/app.js', 'static/initial_data.js']
    all_ok = True
    for path_str in files:
        path = Path(path_str)
        if not path.exists():
            print(f"MISSING: {path}")
            all_ok = False
            continue
        code = path.read_text(encoding='utf-8')
        ok, pos, msg = check_brackets(code)
        if ok:
            print(f"OK: {path}")
        else:
            print(f"ERROR: {path} at pos {pos}: {msg}")
            snippet = code[max(0, pos-50):pos+50]
            print(f"  ...{snippet}...")
            all_ok = False
    return all_ok


if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
