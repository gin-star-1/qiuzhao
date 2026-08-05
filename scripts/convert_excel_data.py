import json
from datetime import datetime, timedelta

def parse_tsv(path):
    rows = []
    with open(path, 'r', encoding='utf-8') as f:
        header = f.readline().strip().split('\t')
        for line in f:
            cols = line.strip().split('\t')
            row = {}
            for i, h in enumerate(header):
                row[h] = cols[i] if i < len(cols) else ''
            rows.append(row)
    return rows

def determine_status(row):
    applied = row.get('是否投递', '').strip()
    result = row.get('网申结果', '').strip()
    if applied != '是':
        return '待投递'
    if '挂' in result:
        return '已拒信'
    return '已投递'

def generate_id(idx):
    return f"excel-{idx:03d}"

def main():
    rows = parse_tsv('qiuzhao-tracker/excel_data.tsv')
    applications = []
    base_date = datetime.now() - timedelta(days=30)

    for idx, row in enumerate(rows, 1):
        status = determine_status(row)
        if status is None:
            continue

        company = row.get('公司', '').strip()
        position = row.get('投递岗位', '').strip()
        link = row.get('链接', '').strip()
        result = row.get('网申结果', '').strip()

        remark = link
        if result and '挂' not in result:
            remark = f"{result} | {remark}" if remark else result
        elif result:
            remark = f"结果：{result} | {remark}" if remark else f"结果：{result}"

        apply_date = (base_date + timedelta(days=idx)).strftime('%Y-%m-%d')

        applications.append({
            'id': generate_id(idx),
            'company': company,
            'position': position or '嵌入式软件',
            'jobType': '开发',
            'city': '',
            'applyDate': apply_date,
            'status': status,
            'nextEvent': '',
            'nextDate': '',
            'remark': remark,
            'logoUrl': ''
        })

    with open('qiuzhao-tracker/initial_data.json', 'w', encoding='utf-8') as f:
        json.dump(applications, f, ensure_ascii=False, indent=2)

    print(f'Generated {len(applications)} applications')

if __name__ == '__main__':
    main()
