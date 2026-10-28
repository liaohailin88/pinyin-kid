# -*- coding: utf-8 -*-
"""检查内置语音有没有"读歪"的条目。

不联网、也不用语音识别：同一个字，三个音色读出来的长度应该在一个量级上。
把每个音色的平均语速当基准，某一条比别的音色长/短一大截，就说明它没按字读
（常见的是被读成英文字母、拼读成几个音，或者干脆没读出来）。

发现异常 → 删掉那条对应文件，重跑 gen_voice.py 换个音色/速度再审。

用法：python scripts/check_voice.py [--show]
"""
import json
import os
import statistics
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, 'assets', 'voice', 'manifest.js')


def load():
    src = open(MAN, encoding='utf-8').read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


def main():
    show = '--show' in sys.argv
    man = load()
    kinds = sorted(man)
    if len(kinds) < 2:
        print('至少要有两个音色才能对比')
        return 2

    # 每个音色的基准语速（只用单音节，词语长度差异太大）
    single = [i for i in man[kinds[0]] if not i.startswith('bw-')]
    base = {k: statistics.median([man[k][i] for i in single if i in man[k]]) for k in kinds}

    bad = 0
    total = 0
    for vid in single:
        vals = {}
        for k in kinds:
            if vid not in man[k]:
                continue
            vals[k] = man[k][vid] / base[k]     # 相对语速
        if len(vals) < 2:
            continue
        total += 1
        med = statistics.median(vals.values())
        worst = max(vals, key=lambda k: abs(vals[k] - med))
        off = abs(vals[worst] - med) / med
        flag = off > 0.75 or man[worst][vid] > 1800
        if flag:
            bad += 1
        if flag or show:
            print('%s %-8s %s' % ('❌' if flag else '  ', vid,
                                 '  '.join('%s %dms' % (k, man[k][vid]) for k in kinds)))

    print('\n检查 %d 条，可疑 %d 条（基准语速：%s）' % (
        total, bad, '  '.join('%s %.0fms' % (k, base[k]) for k in kinds)))
    return 0 if bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
