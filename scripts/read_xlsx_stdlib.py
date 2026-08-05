import zipfile
import xml.etree.ElementTree as ET
import sys
from pathlib import Path


def parse_xlsx(path):
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

    with zipfile.ZipFile(path, 'r') as z:
        # 读取 shared strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            with z.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                for si in root.findall('main:si', ns):
                    texts = []
                    for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                        texts.append(t.text or '')
                    shared_strings.append(''.join(texts))

        # 读取第一个 sheet
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()

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

                row_data = []
                for i in range(1, max_col + 1):
                    row_data.append(cells.get(i, ''))
                rows.append(row_data)

    return rows


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else r'D:\桌面\2026秋招投递.xlsx'
    rows = parse_xlsx(path)
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'qiuzhao-tracker/excel_data.tsv'
    with open(out_path, 'w', encoding='utf-8') as f:
        for row in rows:
            f.write('\t'.join(str(c).replace('\n', ' ').replace('\r', ' ') for c in row) + '\n')
    print(f'Written to {out_path}')
