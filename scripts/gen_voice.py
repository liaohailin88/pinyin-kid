# -*- coding: utf-8 -*-
"""生成「拼音教读」的内置语音。

为什么不用浏览器自带的朗读？
  · 系统 TTS 读不了单独的 b/p/m，只能拿同音汉字去凑，有的音色还读不准（ong 会读成 wēng）；
  · 每台设备的音色不一样，平板上通常只有干巴巴的女声，童声更是没有；
  · 有的手机/平板根本没装中文语音包，直接没声音。

所以这里用 edge-tts（微软的免费神经语音）在“编译期”把 声母 / 韵母 / 拼一拼 需要的声音全部
预生成成 MP3，随仓库一起发布：音色自然、每台设备完全一致、离线也能用。

用法：
  python scripts/gen_voice.py            # 只生成缺的
  python scripts/gen_voice.py --force    # 全部重生成
  python scripts/gen_voice.py --only fin # 只生成某一组（ini / fin / bl / bw）
"""
import asyncio
import json
import os
import sys

import edge_tts
from mutagen.mp3 import MP3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'voice')

# 音色 → (微软神经语音, 语速)；率略慢一点，一年级听得清
# male 用云扬（新闻主播腔），云希读单韵母时会把 鹅 / 恩 / 鞥 拖成两三秒，明显不对
VOICES = {
    'female': ('zh-CN-XiaoxiaoNeural', '-6%'),    # 晓晓：温暖女声
    'male': ('zh-CN-YunyangNeural', '-18%'),      # 云扬：标准男声，慢一点
    'child': ('zh-CN-YunxiaNeural', '-10%'),      # 云夏：少年音，接近童声
}

# 声母 23 个：呼读音用「部编版声母表」下面标注的那些汉字
INI = [
    ('b', '玻'), ('p', '坡'), ('m', '摸'), ('f', '佛'), ('d', '得'),
    ('t', '特'), ('n', '讷'), ('l', '勒'), ('g', '哥'), ('k', '科'),
    ('h', '喝'), ('j', '基'), ('q', '欺'), ('x', '希'), ('zh', '知'),
    ('ch', '吃'), ('sh', '诗'), ('r', '日'), ('z', '资'), ('c', '雌'),
    ('s', '思'), ('y', '衣'), ('w', '屋'),
]

# 韵母 24 个：正体韵母表（啊 喔 鹅 衣 乌 迂 / 哀 诶 威 熬 欧 优 / 耶 约 儿 / 安 恩 因 温 晕 / 昂 鞥 英 嗡）
FIN = [
    ('a', '啊'), ('o', '喔'), ('e', '鹅'), ('i', '衣'), ('u', '乌'), ('ü', '迂'),
    ('ai', '哀'), ('ei', '诶'), ('ui', '威'), ('ao', '熬'), ('ou', '欧'), ('iu', '优'),
    ('ie', '耶'), ('üe', '约'), ('er', '儿'),
    ('an', '安'), ('en', '恩'), ('in', '因'), ('un', '温'), ('ün', '晕'),
    ('ang', '昂'), ('eng', '鞥'), ('ing', '英'), ('ong', '嗡'),
]

# 拼一拼 30 组：(声母, 韵母, 声调, 字, 词语)；音节和字同音，共用一条音频
BLEND = [
    ('b', 'a', 1, '八', '八个'), ('p', 'a', 2, '爬', '爬山'), ('m', 'a', 1, '妈', '妈妈'),
    ('f', 'a', 1, '发', '发芽'), ('d', 'a', 4, '大', '大小'), ('t', 'a', 1, '他', '他们'),
    ('n', 'a', 2, '拿', '拿书'), ('l', 'a', 1, '拉', '拉手'), ('g', 'e', 1, '哥', '哥哥'),
    ('k', 'e', 4, '课', '上课'), ('h', 'e', 2, '河', '小河'), ('j', 'i', 1, '鸡', '小鸡'),
    ('q', 'i', 1, '七', '七个'), ('x', 'i', 1, '西', '西瓜'), ('zh', 'i', 3, '纸', '白纸'),
    ('ch', 'i', 1, '吃', '吃饭'), ('sh', 'i', 2, '十', '十个'), ('r', 'i', 4, '日', '日子'),
    ('z', 'i', 4, '字', '汉字'), ('c', 'i', 4, '刺', '刺猬'), ('s', 'i', 1, '丝', '丝瓜'),
    ('b', 'ai', 2, '白', '白云'), ('d', 'ui', 4, '对', '不对'), ('l', 'iu', 4, '六', '六个'),
    ('m', 'en', 2, '门', '大门'), ('x', 'in', 1, '新', '新年'), ('d', 'eng', 1, '灯', '电灯'),
    ('m', 'ing', 2, '明', '明天'), ('h', 'ong', 2, '红', '红花'), ('q', 'ü', 4, '去', '回去'),
]


def fid(p):
    """文件名安全：ü → v"""
    return p.replace('ü', 'v')


def items():
    """[(组, id, 要合成的文字)]"""
    out = []
    for p, say in INI:
        out.append(('ini', 'ini-' + fid(p), say))
    for p, say in FIN:
        out.append(('fin', 'fin-' + fid(p), say))
    for i, b in enumerate(BLEND):
        out.append(('bl', 'bl-%d' % i, b[3]))
        out.append(('bw', 'bw-%d' % i, b[4]))
    return out


async def one(sem, kind, vid, text, voice, rate, force):
    """合成一条并落盘，返回 {id, ms, say, said, text}；
    顺便用 WordBoundary 记录"真正说话"的那一段（去掉首尾静音），用来校验有没有读出来。"""
    path = os.path.join(OUT, kind, vid + '.mp3')   # kind = 音色（female/male/child）
    if os.path.exists(path) and os.path.getsize(path) > 800 and not force:
        return {'id': vid, 'text': text, 'said': '', 'ms': dur_ms(path)}
    async with sem:
        last = None
        for attempt in range(4):
            try:
                buf = bytearray()
                bmin, bmax, said = None, None, []
                async for ch in edge_tts.Communicate(text, voice, rate=rate).stream():
                    if ch['type'] == 'audio':
                        buf.extend(ch['data'])
                    elif ch['type'] == 'WordBoundary':
                        # offset/duration 单位是 100 纳秒
                        s = ch['offset'] / 10000.0
                        e = (ch['offset'] + ch['duration']) / 10000.0
                        bmin = s if bmin is None else min(bmin, s)
                        bmax = e if bmax is None else max(bmax, e)
                        if (ch.get('text') or '').strip():
                            said.append(ch['text'].strip())
                if len(buf) > 800:
                    with open(path, 'wb') as f:
                        f.write(buf)
                    trim_file(path)
                    return {'id': vid, 'text': text, 'said': '',
                            'ms': dur_ms(path)}
                last = '数据太小'
            except Exception as e:      # 网络抖一下就重试
                last = repr(e)
            await asyncio.sleep(1.2 * (attempt + 1))
        print('!! 失败 %s %s: %s' % (kind, vid, last), file=sys.stderr)
        return None


def dur_ms(path):
    try:
        return int(round(MP3(path).info.length * 1000))
    except Exception:
        return 0


def trim_file(path):
    """切掉首尾静音、把音量拉到 -3dBFS、重新编码成 32kbps 单声道。
    神经语音每条前后都有 0.4~0.8 秒静音，不切掉的话"连读三遍"中间会空等很久。"""
    import miniaudio
    import lameenc

    dec = miniaudio.decode_file(path)
    pcm, sr, ch = dec.samples, dec.sample_rate, dec.nchannels
    n = len(pcm) // ch
    if n < sr * 0.05:
        return False

    def loud(i):
        base = i * ch
        if ch == 1:
            return abs(pcm[base])
        return max(abs(pcm[base + c]) for c in range(ch))

    thr = 700                     # 约 -33dBFS，低于它算静音
    a, b = 0, n - 1
    while a < n and loud(a) < thr:
        a += 1
    while b > a and loud(b) < thr:
        b -= 1
    pad = int(0.05 * sr)          # 前后各留 50ms，别把字头字尾削掉
    a = max(0, a - pad)
    b = min(n - 1, b + pad)
    seg = pcm[a * ch:(b + 1) * ch]
    if not len(seg):
        return False

    peak = max(abs(x) for x in seg) or 1
    gain = min(4.0, 26000.0 / peak)
    out = bytearray()
    for x in seg:
        v = int(x * gain)
        v = 32767 if v > 32767 else (-32768 if v < -32768 else v)
        out += int(v).to_bytes(2, 'little', signed=True)

    enc = lameenc.Encoder()
    enc.set_bit_rate(32)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    data = bytes(enc.encode(bytes(out))) + bytes(enc.flush())
    if len(data) > 600:
        with open(path, 'wb') as f:
            f.write(data)
        return True
    return False


async def main():
    args = sys.argv[1:]
    force = '--force' in args
    only = ''
    if '--only' in args:
        only = args[args.index('--only') + 1]

    todo = [it for it in items() if not only or it[0] == only]
    for kind in VOICES:
        os.makedirs(os.path.join(OUT, kind), exist_ok=True)

    if '--trim' in args:        # 只把已经存在的音频重新剪一遍（不联网）
        n = 0
        for kind in VOICES:
            for g, vid, text in items():
                path = os.path.join(OUT, kind, vid + '.mp3')
                if os.path.exists(path) and trim_file(path):
                    n += 1
        print('已重新裁剪 %d 条' % n)

    sem = asyncio.Semaphore(6)
    pairs = []
    jobs = []
    for kind, (voice, rate) in VOICES.items():
        for g, vid, text in todo:
            pairs.append((kind, g, vid, text))
            jobs.append(one(sem, kind, vid, text, voice, rate, force))
    res = await asyncio.gather(*jobs)

    # 清单：id → 时长(ms)；前端可以据此安排"读第二遍"的间隔
    manifest = {}
    for kind in VOICES:
        manifest[kind] = {}
    total = 0
    odd = []
    for (kind, g, vid, text), r in zip(pairs, res):
        path = os.path.join(OUT, kind, vid + '.mp3')
        if not os.path.exists(path):
            continue
        ms = dur_ms(path)
        manifest[kind][vid] = ms
        total += os.path.getsize(path)
        # 单字 / 单韵母：剪掉静音后应该只有 0.2~1.6 秒
        if g in ('ini', 'fin') and (ms < 180 or ms > 1700):
            odd.append('%s/%s %.2fs「%s」' % (kind, vid, ms / 1000.0, text))

    js = '/* 自动生成：python scripts/gen_voice.py —— 请勿手改 */\n'
    js += 'window.VOICE_MANIFEST = ' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(OUT, 'manifest.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)

    for kind in VOICES:
        n = len(manifest[kind])
        print('%s: %d 条' % (kind, n))
    print('合计 %d 条，%.1f MB' % (len(pairs), total / 1048576.0))
    if odd:
        print('可疑（可能有字没读出来）：')
        for o in odd:
            print('  ' + o)


if __name__ == '__main__':
    asyncio.run(main())
