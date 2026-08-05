"""
把 Excel 中的投递记录直接导入/更新到 SQLite 数据库。
不需要经过 initial_data.js，直接操作 app.db。
"""
import json
import os
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta

# 默认数据库路径（与 Flask 配置一致）
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app.db')
EXCEL_PATH = r'D:\桌面\2026秋招投递.xlsx'


def parse_xlsx(path):
    """使用标准库解析 xlsx，返回二维列表。"""
    import zipfile
    import xml.etree.ElementTree as ET

    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

    with zipfile.ZipFile(path, 'r') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            with z.open('xl/sharedStrings.xml') as f:
                root = ET.parse(f).getroot()
                for si in root.findall('main:si', ns):
                    texts = []
                    for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                        texts.append(t.text or '')
                    shared_strings.append(''.join(texts))

        with z.open('xl/worksheets/sheet1.xml') as f:
            root = ET.parse(f).getroot()
            rows = []
            for row in root.findall('main:sheetData/main:row', ns):
                cells = {}
                max_col = 0
                for c in row.findall('main:c', ns):
                    ref = c.get('r', '')
                    col_idx = 0
                    for ch in ref:
                        if ch.isalpha():
                            col_idx = col_idx * 26 + (ord(ch.upper()) - ord('A') + 1)
                        else:
                            break
                    cell_type = c.get('t', '')
                    v = c.find('main:v', ns)
                    val = v.text if v is not None else ''
                    if cell_type == 's':
                        try:
                            val = shared_strings[int(val)]
                        except (ValueError, IndexError):
                            pass
                    cells[col_idx] = val
                    if col_idx > max_col:
                        max_col = col_idx
                rows.append([cells.get(i, '') for i in range(1, max_col + 1)])
            return rows


def determine_status(applied, result):
    applied = str(applied).strip()
    result = str(result).strip()
    if applied != '是':
        return '待投递'
    if '挂' in result:
        return '已拒信'
    return '已投递'


def ensure_schema(conn):
    """创建与 Flask-SQLAlchemy 兼容的数据表。"""
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(80) UNIQUE NOT NULL,
            password_hash VARCHAR(256) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS applications (
            id VARCHAR(64) PRIMARY KEY,
            user_id INTEGER NOT NULL,
            company VARCHAR(120) NOT NULL,
            position VARCHAR(120) NOT NULL,
            job_type VARCHAR(40) DEFAULT '开发',
            city VARCHAR(60) DEFAULT '',
            apply_date VARCHAR(20) NOT NULL,
            status VARCHAR(40) DEFAULT '已投递',
            next_event VARCHAR(40) DEFAULT '',
            next_date VARCHAR(20) DEFAULT '',
            remark TEXT DEFAULT '',
            logo_url VARCHAR(512) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
    ''')
    conn.commit()


def get_or_create_default_user(conn):
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE username = ?", ('王爷',))
    row = cur.fetchone()
    if row:
        return row[0]

    # 创建一个默认用户，密码也是默认的，登录后可在设置里改
    from werkzeug.security import generate_password_hash
    cur.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        ('王爷', generate_password_hash('qiuzhao123'))
    )
    conn.commit()
    return cur.lastrowid


def generate_id():
    return 'app-' + uuid.uuid4().hex[:12]


def main():
    excel_path = sys.argv[1] if len(sys.argv) > 1 else EXCEL_PATH
    db_path = sys.argv[2] if len(sys.argv) > 2 else DB_PATH

    if not os.path.exists(excel_path):
        print(f'Excel 文件不存在: {excel_path}')
        sys.exit(1)

    rows = parse_xlsx(excel_path)
    if len(rows) < 2:
        print('Excel 中没有数据')
        sys.exit(1)

    header = [str(h).strip() for h in rows[0]]
    try:
        col_company = header.index('公司')
        col_applied = header.index('是否投递')
        col_position = header.index('投递岗位')
        col_link = header.index('链接') if '链接' in header else -1
        col_result = header.index('网申结果') if '网申结果' in header else -1
    except ValueError as e:
        print(f'Excel 表头缺失: {e}')
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    ensure_schema(conn)
    user_id = get_or_create_default_user(conn)

    base_date = datetime.now() - timedelta(days=30)
    inserted = 0
    updated = 0
    skipped = 0

    for idx, cols in enumerate(rows[1:], 1):
        company = str(cols[col_company]).strip()
        position = str(cols[col_position]).strip()
        applied = str(cols[col_applied]).strip() if col_applied < len(cols) else ''
        link = str(cols[col_link]).strip() if col_link >= 0 and col_link < len(cols) else ''
        result = str(cols[col_result]).strip() if col_result >= 0 and col_result < len(cols) else ''

        if not company:
            skipped += 1
            continue

        status = determine_status(applied, result)

        remark = link
        if result and '挂' not in result:
            remark = f"{result} | {remark}" if remark else result
        elif result:
            remark = f"结果：{result} | {remark}" if remark else f"结果：{result}"

        apply_date = (base_date + timedelta(days=idx)).strftime('%Y-%m-%d')

        # 以 公司+岗位 作为唯一标识，判断是新增还是更新
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM applications WHERE user_id = ? AND company = ? AND position = ?",
            (user_id, company, position)
        )
        existing = cur.fetchone()

        if existing:
            cur.execute('''
                UPDATE applications
                SET status = ?, remark = ?, apply_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (status, remark, apply_date, existing[0]))
            updated += 1
        else:
            cur.execute('''
                INSERT INTO applications
                (id, user_id, company, position, job_type, city, apply_date, status,
                 next_event, next_date, remark, logo_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                generate_id(), user_id, company, position or '嵌入式软件', '开发', '',
                apply_date, status, '', '', remark, ''
            ))
            inserted += 1

    conn.commit()
    conn.close()

    print(f'导入完成：新增 {inserted} 条，更新 {updated} 条，跳过 {skipped} 条')


if __name__ == '__main__':
    main()
