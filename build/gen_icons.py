# -*- coding: utf-8 -*-
"""표지 39종 × (위험 d / 대책 s) 픽토그램 SVG 생성 → assets/data.js 의 var ICON2 로 주입.
캔버스 160×120. 왼쪽 위(번호 배지)·오른쪽 위(✕/✓ 배지) 모서리는 비워 둔다."""
import json, re, math, sys

INK = '#2b2b2b'; SKIN = '#f1c9a5'; HAT = '#FFD23F'; VEST = '#FF8A1F'; RED = '#D32F2F'; GRN = '#1E7B3A'
GRAY = '#8d8d86'; STEEL = '#6b6f72'; WATER = '#5DADE2'; BOLT = '#FFD23F'; ORG = '#FF7A00'; BLUE = '#1F5A9A'

def person(x, y, s=1.0, helmet=True, vest=False, pose='stand', rot=0, gloves=False, harness=False):
    """(x,y)=발 중심. pose: stand/reach/bend/kneel/fall/carry/up"""
    g = []
    hy = -46
    if pose == 'bend': body = 'M0,-30 L-10,-14'; head = (-14, -36); arms = 'M-4,-24 l14,8 M-4,-24 l10,12'; legs = 'M-10,-14 l-4,14 M-10,-14 l8,14'
    elif pose == 'kneel': body = 'M0,-34 L0,-14'; head = (0, -42); arms = 'M0,-28 l14,6 M0,-28 l12,10'; legs = 'M0,-14 l12,0 l0,14 M0,-14 l-6,14'
    elif pose == 'reach': body = 'M0,-36 L0,-14'; head = (0, -44); arms = 'M0,-30 l14,-14 M0,-30 l-12,-12'; legs = 'M0,-14 l-7,14 M0,-14 l7,14'
    elif pose == 'carry': body = 'M0,-36 L0,-14'; head = (0, -44); arms = 'M0,-30 l14,2 M0,-30 l14,8'; legs = 'M0,-14 l-7,14 M0,-14 l7,14'
    elif pose == 'point': body = 'M0,-36 L0,-14'; head = (0, -44); arms = 'M0,-30 l18,-8 M0,-30 l-8,12'; legs = 'M0,-14 l-7,14 M0,-14 l7,14'
    else: body = 'M0,-36 L0,-14'; head = (0, -44); arms = 'M0,-30 l-10,12 M0,-30 l10,12'; legs = 'M0,-14 l-7,14 M0,-14 l7,14'
    g.append(f'<path d="{body} {legs}" stroke="{INK}" stroke-width="5" stroke-linecap="round" fill="none"/>')
    if vest: g.append(f'<path d="{body}" stroke="{VEST}" stroke-width="9" stroke-linecap="round"/>')
    if harness: g.append(f'<path d="{body}" stroke="{ORG}" stroke-width="3" stroke-dasharray="3 2"/><circle cx="{head[0]}" cy="{head[1] + 14}" r="2.5" fill="{ORG}"/>')
    g.append(f'<path d="{arms}" stroke="{INK}" stroke-width="4.5" stroke-linecap="round" fill="none"/>')
    if gloves:
        for m in re.finditer(r'M(-?\d+),(-?\d+) l(-?\d+),(-?\d+)', arms):
            hx, hy2 = int(m.group(1)) + int(m.group(3)), int(m.group(2)) + int(m.group(4))
            g.append(f'<circle cx="{hx}" cy="{hy2}" r="4" fill="{ORG}" stroke="{INK}" stroke-width="1.2"/>')
    g.append(f'<circle cx="{head[0]}" cy="{head[1]}" r="7" fill="{SKIN}" stroke="{INK}" stroke-width="2"/>')
    if helmet: g.append(f'<path d="M{head[0] - 8},{head[1] - 2} a8,8 0 0 1 16,0 z" fill="{HAT}" stroke="{INK}" stroke-width="1.6"/><rect x="{head[0] - 9}" y="{head[1] - 3}" width="18" height="2.6" fill="{HAT}" stroke="{INK}" stroke-width="1"/>')
    else: g.append(f'<path d="M{head[0] - 7},{head[1] - 3} a7,6 0 0 1 14,0 z" fill="#3b5ba5"/>')
    return f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">' + ''.join(g) + '</g>'

def bolt(x, y, s=1.0): return f'<path transform="translate({x},{y}) scale({s})" d="M6,-14 L-6,2 L1,2 L-4,14 L9,-3 L2,-3 L6,-14z" fill="{BOLT}" stroke="#3a2a00" stroke-width="1.6" stroke-linejoin="round"/>'
def ground(y=108, x1=6, x2=154): return f'<path d="M{x1},{y} H{x2}" stroke="{GRAY}" stroke-width="3"/>'
def panel(x, y, open_=True, lock=False):
    g = f'<rect x="{x}" y="{y}" width="34" height="46" rx="2" fill="#d9dde0" stroke="{INK}" stroke-width="2"/>'
    if open_:
        g += f'<path d="M{x},{y} l-14,6 v40 l14,-6" fill="#c3c9cd" stroke="{INK}" stroke-width="2"/>'
        g += ''.join(f'<rect x="{x + 6 + i * 8}" y="{y + 8}" width="4" height="26" fill="#C7792B"/>' for i in range(3))
    else:
        g += f'<path d="M{x + 17},{y + 4} v38" stroke="{INK}" stroke-width="1.2"/><path d="M{x + 11},{y + 14} l5,-6 l-3,0 l3,-6" stroke="{BOLT}" stroke-width="2" fill="none"/>'
    if lock:
        g += f'<rect x="{x + 22}" y="{y + 24}" width="10" height="9" rx="1.5" fill="{RED}"/><path d="M{x + 24},{y + 24} v-4 a3,3 0 0 1 6,0 v4" stroke="{RED}" stroke-width="2" fill="none"/>'
        g += f'<path d="M{x + 27},{y + 33} l-4,8 h8z" fill="#fff" stroke="{RED}" stroke-width="1.3"/>'
    return g
def puddle(x, y, w=50): return f'<ellipse cx="{x}" cy="{y}" rx="{w / 2}" ry="5" fill="{WATER}" opacity=".75"/>'
def cable(d, col='#222'): return f'<path d="{d}" stroke="{col}" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
def rail(x, y, w, h=22):
    posts = ''.join(f'<rect x="{x + i * (w - 4) / 2:.0f}" y="{y}" width="4" height="{h}" fill="{HAT}" stroke="{INK}" stroke-width="1"/>' for i in range(3))
    return posts + f'<rect x="{x}" y="{y}" width="{w}" height="4" fill="{HAT}" stroke="{INK}" stroke-width="1"/><rect x="{x}" y="{y + h / 2}" width="{w}" height="3" fill="{HAT}" stroke="{INK}" stroke-width="1"/>'
def slab(x, y, w, h=8): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{GRAY}"/>'
def dash_zone(cx, cy, r, col=RED): return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" stroke-width="2.5" stroke-dasharray="6 4"/>'
def sparks(x, y, col='#FF9800'):
    return ''.join(f'<path d="M{x},{y} l{12 * math.cos(a):.1f},{12 * math.sin(a):.1f}" stroke="{col}" stroke-width="2.5" stroke-linecap="round"/>' for a in [-2.6, -2.0, -1.4, -0.8, -0.2])
def flame(x, y, s=1): return f'<path transform="translate({x},{y}) scale({s})" d="M0,0 C-10,-6 -6,-18 0,-26 C2,-16 10,-14 8,-6 C7,-1 4,0 0,0z" fill="#FF5722" stroke="#B71C1C" stroke-width="1.4"/>'
def extinguisher(x, y): return f'<rect x="{x}" y="{y}" width="12" height="26" rx="5" fill="{RED}" stroke="{INK}" stroke-width="1.5"/><path d="M{x + 6},{y} v-5 h8" stroke="{INK}" stroke-width="2" fill="none"/>'
def anchor_line(x1, y, x2): return f'<path d="M{x1},{y} H{x2}" stroke="{BLUE}" stroke-width="3"/><circle cx="{x1}" cy="{y}" r="3" fill="{BLUE}"/><circle cx="{x2}" cy="{y}" r="3" fill="{BLUE}"/>'
def lanyard(x1, y1, x2, y2): return f'<path d="M{x1},{y1} Q{(x1 + x2) / 2},{max(y1, y2) + 10} {x2},{y2}" stroke="{ORG}" stroke-width="2.5" fill="none"/>'
def ladder(x, y, h=60, lean=10):
    g = f'<path d="M{x},{y} L{x + lean},{y - h} M{x + 14},{y} L{x + 14 + lean},{y - h}" stroke="{STEEL}" stroke-width="3"/>'
    for i in range(1, 6): t = i / 6; g += f'<path d="M{x + lean * t},{y - h * t} h14" stroke="{STEEL}" stroke-width="2.4"/>'
    return g
def pole_line(x=24, top=24): return f'<rect x="{x}" y="{top}" width="6" height="{108 - top}" fill="{STEEL}"/><rect x="{x - 14}" y="{top + 4}" width="34" height="4" fill="{STEEL}"/><path d="M0,{top + 8} H160" stroke="#222" stroke-width="2"/><path d="M0,{top + 14} H160" stroke="#222" stroke-width="1.5"/>'
def crane(x, y, angle=-50, len_=70):
    a = math.radians(angle); ex, ey = x + len_ * math.cos(a), y + len_ * math.sin(a)
    return (f'<rect x="{x - 18}" y="{y}" width="36" height="14" rx="3" fill="{HAT}" stroke="{INK}" stroke-width="1.6"/>'
            f'<circle cx="{x - 10}" cy="{y + 16}" r="5" fill="{INK}"/><circle cx="{x + 10}" cy="{y + 16}" r="5" fill="{INK}"/>'
            f'<path d="M{x},{y} L{ex:.0f},{ey:.0f}" stroke="{HAT}" stroke-width="6" stroke-linecap="round"/><path d="M{x},{y} L{ex:.0f},{ey:.0f}" stroke="{INK}" stroke-width="1.2" fill="none"/>'
            f'<path d="M{ex:.0f},{ey:.0f} v26" stroke="{INK}" stroke-width="1.5"/>'), (ex, ey)
def excavator(x, y, flip=False):
    sx = -1 if flip else 1
    return (f'<g transform="translate({x},{y}) scale({sx},1)"><rect x="-20" y="-6" width="40" height="10" rx="5" fill="{INK}"/><rect x="-16" y="-24" width="26" height="18" rx="2" fill="{HAT}" stroke="{INK}" stroke-width="1.5"/>'
            f'<rect x="-12" y="-21" width="10" height="9" fill="#bfe3ff" stroke="{INK}" stroke-width="1"/><path d="M10,-18 L34,-36 L48,-16" stroke="{HAT}" stroke-width="6" stroke-linecap="round" fill="none"/>'
            f'<path d="M44,-18 l10,8 l-12,2z" fill="{STEEL}"/></g>')
def forklift(x, y, flip=False):
    sx = -1 if flip else 1
    return (f'<g transform="translate({x},{y}) scale({sx},1)"><rect x="-18" y="-22" width="28" height="18" rx="2" fill="{HAT}" stroke="{INK}" stroke-width="1.5"/><path d="M-12,-22 v-14 h16 v14" stroke="{INK}" stroke-width="2" fill="none"/>'
            f'<path d="M12,-40 v36 M12,-6 h16" stroke="{STEEL}" stroke-width="3"/><circle cx="-10" cy="-2" r="6" fill="{INK}"/><circle cx="6" cy="-2" r="6" fill="{INK}"/></g>')
def gear(x, y, r=18, cover=False):
    g = ''.join(f'<rect x="{x - 4}" y="{y - r - 6}" width="8" height="10" fill="{STEEL}" transform="rotate({k * 45} {x} {y})"/>' for k in range(8))
    g += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{STEEL}"/><circle cx="{x}" cy="{y}" r="5" fill="#ddd"/>'
    if cover: g += f'<path d="M{x - r - 10},{y} a{r + 10},{r + 10} 0 0 1 {2 * (r + 10)},0 v{r + 6} h-{2 * (r + 10)}z" fill="{HAT}" stroke="{INK}" stroke-width="2" opacity=".95"/>'
    return g
def box(x, y, w=26, h=20): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#C8A26B" stroke="{INK}" stroke-width="1.8"/><path d="M{x},{y + h / 2} h{w}" stroke="{INK}" stroke-width="1"/>'
def sign(x, y, lines, col='#fff'):
    g = f'<rect x="{x}" y="{y}" width="46" height="{10 + 9 * len(lines)}" rx="3" fill="{col}" stroke="{INK}" stroke-width="2"/>'
    for i, (t, c) in enumerate(lines): g += f'<text x="{x + 23}" y="{y + 13 + 9 * i}" font-size="8" font-weight="700" text-anchor="middle" fill="{c}" font-family="sans-serif">{t}</text>'
    return g
def manhole(x, y, gas=False):
    g = f'<ellipse cx="{x}" cy="{y}" rx="26" ry="8" fill="#444" stroke="{INK}" stroke-width="2"/><path d="M{x - 26},{y} v26 a26,8 0 0 0 52,0 v-26" fill="#666" stroke="{INK}" stroke-width="2"/>'
    if gas: g += ''.join(f'<circle cx="{x + dx}" cy="{y - dy}" r="{r}" fill="#9CCC65" opacity=".75"/>' for dx, dy, r in [(-10, 10, 8), (4, 16, 10), (14, 8, 7), (-2, 26, 7)])
    return g
def sun(x, y): return f'<circle cx="{x}" cy="{y}" r="11" fill="#FFB300"/>' + ''.join(f'<path d="M{x + 15 * math.cos(a):.1f},{y + 15 * math.sin(a):.1f} l{6 * math.cos(a):.1f},{6 * math.sin(a):.1f}" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/>' for a in [i * math.pi / 4 for i in range(8)])
def plug(x, y): return f'<rect x="{x}" y="{y}" width="16" height="12" rx="3" fill="#eee" stroke="{INK}" stroke-width="1.8"/><path d="M{x + 16},{y + 3} h6 M{x + 16},{y + 9} h6" stroke="{INK}" stroke-width="2"/>'
def drill(x, y): return f'<path d="M{x},{y} h30 v10 h-14 l-4,16 h-8 l2,-16 h-6z" fill="{ORG}" stroke="{INK}" stroke-width="1.6"/><path d="M{x + 30},{y + 5} h12" stroke="{STEEL}" stroke-width="3"/>'
def reel(x, y, coiled=True):
    g = f'<circle cx="{x}" cy="{y}" r="16" fill="{ORG}" stroke="{INK}" stroke-width="2"/><circle cx="{x}" cy="{y}" r="5" fill="#fff" stroke="{INK}" stroke-width="1.5"/>'
    if coiled: g += ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#222" stroke-width="2"/>' for r in (9, 12))
    return g
def heat(x, y): return ''.join(f'<path d="M{x + dx},{y} q-4,-6 0,-12 q4,-6 0,-12" stroke="#E53935" stroke-width="2" fill="none"/>' for dx in (-8, 0, 8))
def scaffold(x, y, w=70, h=60, gap=False, rail_=False):
    g = f'<path d="M{x},{y} v-{h} M{x + w},{y} v-{h} M{x},{y - h / 2} h{w}" stroke="{STEEL}" stroke-width="3"/>'
    planks = [(x + i * w / 4, w / 4 - 2) for i in range(4)]
    for i, (px, pw) in enumerate(planks):
        if gap and i == 2: continue
        g += f'<rect x="{px:.0f}" y="{y - h - 4}" width="{pw:.0f}" height="5" fill="#C8A26B" stroke="{INK}" stroke-width="1"/>'
    if rail_: g += f'<path d="M{x},{y - h - 26} h{w} M{x},{y - h - 14} h{w}" stroke="{HAT}" stroke-width="3"/><path d="M{x},{y - h} v-26 M{x + w},{y - h} v-26" stroke="{HAT}" stroke-width="3"/>'
    return g
def W(*parts): return ''.join(parts)

I = {}
# ── 전기설비 U01~U19
I['U01_d'] = W(ground(), panel(70, 46, True), bolt(64, 60, 1.2), person(118, 108, pose='reach'))
I['U01_s'] = W(ground(), panel(52, 50, False, lock=True), person(118, 108, gloves=True))
I['U02_d'] = W(ground(), panel(14, 52, False), cable('M48,74 C70,108 90,106 150,106'), person(108, 104, pose='stand', rot=18), sparks(98, 104))
I['U02_s'] = W(ground(), panel(14, 52, False), f'<path d="M70,108 v-40 M120,108 v-40" stroke="{STEEL}" stroke-width="3"/>', cable('M48,62 Q70,66 70,68 Q95,74 120,68 Q140,64 152,70'), person(96, 108))
I['U03_d'] = W(ground(), puddle(80, 108, 70), plug(60, 76), cable('M60,82 Q40,92 30,108'), person(100, 108, pose='kneel'), bolt(54, 66, 1.1))
I['U03_s'] = W(ground(), plug(60, 76), cable('M60,82 Q40,92 30,108'), person(100, 108, pose='kneel', gloves=True), f'<rect x="80" y="104" width="44" height="4" fill="{GRN}"/>')
I['U04_d'] = W(ground(), '<rect x="40" y="40" width="40" height="50" rx="3" fill="#d9dde0" stroke="#2b2b2b" stroke-width="2"/>', f'<text x="60" y="70" font-size="13" font-weight="700" text-anchor="middle" fill="{RED}" font-family="sans-serif">?</text>', bolt(100, 72, 1.3), cable('M80,82 Q110,96 150,96'))
I['U04_s'] = W(ground(), '<rect x="40" y="40" width="40" height="50" rx="3" fill="#d9dde0" stroke="#2b2b2b" stroke-width="2"/>', f'<rect x="48" y="50" width="24" height="18" rx="2" fill="#fff" stroke="{INK}" stroke-width="1.5"/><circle cx="60" cy="59" r="4" fill="{GRN}"/><text x="60" y="82" font-size="9" font-weight="700" text-anchor="middle" fill="{GRN}" font-family="sans-serif">TEST</text>', cable('M80,82 Q110,96 150,96'), person(124, 108, pose='point'))
I['U05_d'] = W(ground(), panel(30, 52, True), person(98, 108, pose='reach'), bolt(84, 52, 1.1))
I['U05_s'] = W(ground(), panel(30, 52, True), person(98, 108, pose='reach', gloves=True), f'<rect x="88" y="104" width="22" height="5" rx="2" fill="{ORG}"/>')
I['U06_d'] = W(ground(), puddle(82, 106, 110), cable('M10,90 Q50,112 150,104'), person(104, 106), bolt(66, 94, 1.2))
I['U06_s'] = W(ground(), puddle(70, 106, 80), f'<path d="M40,108 v-22 M100,108 v-22" stroke="{STEEL}" stroke-width="3"/>', cable('M10,84 Q40,84 40,86 Q70,90 100,86 Q130,82 150,88'), f'<rect x="112" y="104" width="40" height="4" fill="{GRN}"/>', person(130, 104, gloves=True))
I['U07_d'] = W(ground(), drill(30, 52), cable('M44,78 Q60,100 96,96 Q120,92 150,104'), sparks(78, 98), bolt(90, 82, 1))
I['U07_s'] = W(ground(), drill(30, 52), cable('M44,78 Q60,100 96,96 Q120,92 150,104'), f'<path d="M126,72 v14 M118,86 h16 M121,90 h10 M124,94 h4" stroke="{GRN}" stroke-width="2.5"/>')
I['U08_d'] = W(ground(), reel(66, 80, True), heat(66, 60), flame(96, 104, 1.1), cable('M82,80 Q110,84 140,100'))
I['U08_s'] = W(ground(), reel(40, 82, False), cable('M56,82 Q90,108 150,98', '#222'), f'<path d="M120,60 h24 v20 h-24z" fill="#fff" stroke="{INK}" stroke-width="1.6"/><circle cx="132" cy="70" r="4" fill="{GRN}"/>')
I['U09_d'] = W(pole_line(20, 30), scaffold(70, 108, 60, 40), person(100, 64, pose='reach'), bolt(106, 46, 1))
I['U09_s'] = W(pole_line(20, 30), f'<rect x="60" y="34" width="90" height="10" rx="5" fill="{ORG}" opacity=".85"/>', scaffold(70, 108, 60, 30), person(100, 74), f'<path d="M134,46 v26" stroke="{GRN}" stroke-width="2" marker-end=""/><text x="140" y="64" font-size="8" fill="{GRN}" font-family="sans-serif">90cm</text>')
c, (ex, ey) = crane(60, 90, -45, 80); I['U10_d'] = W(ground(), pole_line(120, 30), c, bolt(118, 36, 1.1))
c, (ex, ey) = crane(50, 90, -60, 56); I['U10_s'] = W(ground(), pole_line(130, 30), c, dash_zone(132, 38, 26, GRN), person(104, 108, vest=True, pose='point'))
I['U11_d'] = W(ground(), pole_line(130, 26), f'<path d="M84,108 L118,34" stroke="{STEEL}" stroke-width="5"/>', person(90, 108, pose='reach'), bolt(118, 34, 1))
I['U11_s'] = W(ground(), pole_line(130, 26), f'<path d="M30,82 H120" stroke="{STEEL}" stroke-width="5"/>', person(56, 108, pose='carry'), person(100, 108, pose='carry'))
I['U12_d'] = W(ground(), f'<rect x="96" y="24" width="7" height="84" fill="{STEEL}"/>', pole_line(96, 24)[0:0], person(86, 62, pose='reach'), f'<path d="M92,62 h10" stroke="{INK}" stroke-width="3"/>', f'<path d="M60,70 v34" stroke="{RED}" stroke-width="2" stroke-dasharray="4 3"/>')
I['U12_s'] = W(ground(), f'<rect x="96" y="24" width="7" height="84" fill="{STEEL}"/>', person(86, 62, pose='reach', harness=True), lanyard(86, 40, 98, 36), f'<circle cx="99" cy="36" r="3" fill="{BLUE}"/>')
I['U13_d'] = W(ground(), ladder(64, 108, 64, 8), person(80, 48, pose='reach'), f'<path d="M66,108 l-8,-4" stroke="{RED}" stroke-width="3"/>')
I['U13_s'] = W(ground(), ladder(64, 108, 60, 8), person(80, 52, pose='stand'), person(110, 108, vest=True, pose='point'), f'<path d="M58,108 h40" stroke="{HAT}" stroke-width="4"/>')
I['U14_d'] = W(ground(), panel(30, 52, True), person(96, 108, pose='reach'), f'<text x="130" y="60" font-size="22" font-weight="700" fill="{RED}" font-family="sans-serif">?</text>')
I['U14_s'] = W(ground(), panel(20, 52, True), person(80, 108, pose='reach', gloves=True), person(128, 108, vest=True, pose='point'), f'<rect x="138" y="56" width="12" height="9" fill="{GRN}"/>')
I['U15_d'] = W(ground(), sign(26, 40, [('위험', RED), ('접근금지', INK)]), person(106, 108), f'<text x="120" y="54" font-size="20" font-weight="700" fill="{RED}" font-family="sans-serif">?</text>')
I['U15_s'] = W(ground(), sign(20, 34, [('위험 Danger', RED), ('危险 Nguy hiểm', INK), ('Xavfli', INK)]), person(108, 108))
I['U16_d'] = W(ground(), panel(30, 50, True), f'<rect x="72" y="58" width="14" height="22" rx="2" fill="#fff" stroke="{INK}" stroke-width="1.6"/><rect x="75" y="61" width="8" height="8" fill="{RED}"/><text x="79" y="78" font-size="6" text-anchor="middle" font-family="sans-serif">ON</text>', person(116, 108, pose='reach'), bolt(64, 44, 1))
I['U16_s'] = W(ground(), panel(18, 50, False, lock=True), f'<rect x="76" y="44" width="34" height="44" rx="2" fill="#fff" stroke="{INK}" stroke-width="2"/>' + ''.join(f'<path d="M82,{54 + i * 8} h22" stroke="{STEEL}" stroke-width="2"/><path d="M80,{54 + i * 8} l2,2 l3,-4" stroke="{GRN}" stroke-width="1.6" fill="none"/>' for i in range(4)), person(132, 108))
I['U17_d'] = W(ground(), manhole(74, 82, True), person(76, 84, s=.8, pose='reach'))
I['U17_s'] = W(ground(), manhole(70, 82, False), f'<rect x="108" y="66" width="14" height="22" rx="2" fill="{HAT}" stroke="{INK}" stroke-width="1.5"/><rect x="111" y="70" width="8" height="6" fill="#bfe3ff"/><text x="115" y="84" font-size="6" text-anchor="middle" font-family="sans-serif">O₂</text>', f'<circle cx="34" cy="62" r="10" fill="none" stroke="{STEEL}" stroke-width="3"/><path d="M34,72 Q40,80 58,80" stroke="{STEEL}" stroke-width="4" fill="none"/>', person(140, 108, vest=True))
I['U18_d'] = W(f'<rect x="0" y="86" width="160" height="34" fill="#a1887f"/>', cable('M0,104 H160', '#222'), excavator(40, 86), bolt(98, 98, 1.1))
I['U18_s'] = W(f'<rect x="0" y="86" width="160" height="34" fill="#a1887f"/>', cable('M0,104 H160', '#222'), ''.join(f'<path d="M{x},86 v-20" stroke="{INK}" stroke-width="2"/><path d="M{x},66 l12,4 l-12,4z" fill="{ORG}"/>' for x in (40, 80, 120)), person(100, 86, pose='bend'))
I['U19_d'] = W(ground(), panel(24, 52, False), person(100, 108, pose='bend'), sparks(84, 92), flame(62, 104, .9))
I['U19_s'] = W(ground(), panel(18, 52, False), f'<rect x="54" y="70" width="34" height="38" fill="#ffcc80" stroke="{INK}" stroke-width="1.5"/>', person(110, 108, pose='bend'), extinguisher(136, 82))
# ── 일반 건설 G01~G20
I['G01_d'] = W(slab(0, 64, 70), slab(100, 64, 60), f'<path d="M70,64 v44 M100,64 v44" stroke="{GRAY}" stroke-width="2" stroke-dasharray="4 3"/>', person(66, 64, rot=24, pose='reach'), ground())
I['G01_s'] = W(slab(0, 64, 160), f'<rect x="70" y="58" width="30" height="6" fill="{HAT}" stroke="{INK}" stroke-width="1"/>', rail(110, 40, 46), person(46, 64), ground())
I['G02_d'] = W(slab(0, 60, 96), f'<path d="M96,60 v48" stroke="{GRAY}" stroke-width="2" stroke-dasharray="4 3"/>', person(90, 60, pose='reach'), ground(), f'<path d="M110,66 v36" stroke="{RED}" stroke-width="2" stroke-dasharray="4 3"/><path d="M104,96 l6,8 l6,-8" stroke="{RED}" stroke-width="2" fill="none"/>')
I['G02_s'] = W(slab(0, 60, 96), anchor_line(10, 26, 120), person(80, 60, harness=True), lanyard(80, 32, 84, 26), ground())
I['G03_d'] = W(ground(), scaffold(40, 108, 90, 50, gap=True), person(70, 54, pose='reach'), f'<path d="M92,56 v40" stroke="{RED}" stroke-width="2" stroke-dasharray="4 3"/>')
I['G03_s'] = W(ground(), scaffold(40, 108, 90, 50, rail_=True), person(80, 54))
I['G04_d'] = W(ground(), ladder(70, 108, 66, 16), person(92, 46, pose='reach', rot=-10), f'<path d="M68,108 l-10,-2" stroke="{RED}" stroke-width="3"/>')
I['G04_s'] = W(ground(), ladder(70, 108, 60, 12), person(88, 52), person(116, 108, vest=True, pose='point'), f'<path d="M58,108 h40" stroke="{HAT}" stroke-width="5"/>')
I['G05_d'] = W(ground(), f'<rect x="40" y="96" width="60" height="10" fill="{HAT}" stroke="{INK}" stroke-width="1.5"/><path d="M50,96 L70,56 M90,96 L70,56" stroke="{STEEL}" stroke-width="3"/><rect x="50" y="46" width="40" height="12" fill="none" stroke="{HAT}" stroke-width="3"/>', person(98, 50, rot=30, pose='reach'))
I['G05_s'] = W(ground(), f'<rect x="40" y="96" width="60" height="10" fill="{HAT}" stroke="{INK}" stroke-width="1.5"/><path d="M50,96 L70,56 M90,96 L70,56" stroke="{STEEL}" stroke-width="3"/><rect x="50" y="46" width="40" height="12" fill="none" stroke="{HAT}" stroke-width="3"/>', person(70, 50, harness=True, s=.85), lanyard(70, 34, 56, 46))
c, (ex, ey) = crane(30, 86, -40, 70); I['G06_d'] = W(ground(), c, box(ex - 13, ey + 26), person(int(ex), 108), f'<path d="M{ex - 16:.0f},{ey + 50:.0f} v8" stroke="{RED}" stroke-width="2"/>')
c, (ex, ey) = crane(30, 86, -40, 70); I['G06_s'] = W(ground(), c, box(ex - 13, ey + 26), f'<path d="M{ex - 24:.0f},104 h48" stroke="{RED}" stroke-width="3" stroke-dasharray="6 3"/>', person(146, 108, vest=True, pose='point'))
I['G07_d'] = W(ground(), slab(0, 40, 70), box(40, 22, 20, 18), box(70, 54, 14, 12), box(90, 76, 12, 10), person(110, 108))
I['G07_s'] = W(ground(), slab(0, 40, 70), box(40, 22, 20, 18), f'<path d="M70,44 L150,58" stroke="{GRN}" stroke-width="3"/>' + ''.join(f'<path d="M{70 + i * 10},{44 + i * 1.75:.1f} v6" stroke="{GRN}" stroke-width="1.2"/>' for i in range(9)), person(110, 108))
I['G08_d'] = W(ground(), excavator(54, 104), person(108, 108), dash_zone(60, 80, 48))
I['G08_s'] = W(ground(), excavator(46, 104), dash_zone(52, 80, 40, GRN), person(130, 108, vest=True, pose='point'))
I['G09_d'] = W(ground(), forklift(62, 108, flip=True), person(92, 108), f'<path d="M66,92 h18" stroke="{RED}" stroke-width="3" marker-end=""/>')
I['G09_s'] = W(ground(), forklift(52, 108), f'<path d="M96,108 V60 M150,108 V60" stroke="{HAT}" stroke-width="3" stroke-dasharray="6 4"/>', person(122, 108, vest=True))
I['G10_d'] = W(ground(), gear(60, 66, 18, False), person(108, 108, pose='reach'), f'<path d="M86,62 h-6" stroke="{RED}" stroke-width="3"/>')
I['G10_s'] = W(ground(), gear(60, 70, 18, True), person(118, 108))
I['G11_d'] = W(f'<path d="M0,60 H40 V112 H110 V60 H160 V120 H0Z" fill="#a1887f"/>', f'<path d="M110,60 q-14,18 -4,36" fill="#8d6e63" stroke="{INK}" stroke-width="1.5"/>', person(76, 112, s=.9))
I['G11_s'] = W(f'<path d="M0,60 H30 L50,112 H100 L120,60 H160 V120 H0Z" fill="#a1887f"/>', f'<path d="M44,84 H106 M48,98 H102" stroke="{STEEL}" stroke-width="4"/>', person(76, 112, s=.9))
I['G12_d'] = W(ground(), slab(10, 40, 140, 10), f'<path d="M30,50 L40,108 M70,50 L64,108 M110,50 L124,108" stroke="{STEEL}" stroke-width="4"/>', f'<path d="M50,42 l6,-10 l6,10" stroke="{RED}" stroke-width="2" fill="none"/>', person(140, 108, s=.8))
I['G12_s'] = W(ground(), slab(10, 40, 140, 10), ''.join(f'<path d="M{x},50 V108" stroke="{STEEL}" stroke-width="4"/>' for x in (30, 70, 110, 140)), f'<path d="M30,80 H140" stroke="{STEEL}" stroke-width="2.5"/>')
I['G13_d'] = W(ground(), f'<path d="M20,108 V40 H80 L70,60 L84,76 L72,108Z" fill="#bcaaa4" stroke="{INK}" stroke-width="2"/>', box(86, 70, 14, 12), person(116, 108))
I['G13_s'] = W(ground(), f'<path d="M14,108 V50 H60 L54,70 L64,108Z" fill="#bcaaa4" stroke="{INK}" stroke-width="2"/>', f'<path d="M78,108 V70 M78,72 H150" stroke="{RED}" stroke-width="3" stroke-dasharray="6 3"/>', excavator(120, 104, flip=True))
I['G14_d'] = W(ground(), person(56, 108, pose='bend'), sparks(70, 92), f'<rect x="96" y="80" width="18" height="28" rx="2" fill="{RED}" stroke="{INK}" stroke-width="1.5"/>', flame(118, 82, 1))
I['G14_s'] = W(ground(), person(50, 108, pose='bend'), f'<rect x="64" y="72" width="30" height="36" fill="#ffcc80" stroke="{INK}" stroke-width="1.5"/>', extinguisher(104, 82), person(136, 108, vest=True))
I['G15_d'] = W(ground(), manhole(70, 82, True), person(70, 84, s=.8, pose='reach'))
I['G15_s'] = W(ground(), manhole(66, 82, False), f'<rect x="104" y="66" width="14" height="22" rx="2" fill="{HAT}" stroke="{INK}" stroke-width="1.5"/>', f'<circle cx="30" cy="62" r="10" fill="none" stroke="{STEEL}" stroke-width="3"/>', person(138, 108, vest=True))
I['G16_d'] = W(ground(), person(60, 108, helmet=False), person(110, 108, helmet=False), f'<path d="M40,54 l12,12 M52,54 l-12,12" stroke="{RED}" stroke-width="3"/>')
I['G16_s'] = W(ground(), person(60, 108, vest=True, gloves=True), person(110, 108, vest=True, harness=True))
I['G17_d'] = W(ground(), box(40, 96, 18, 12), f'<path d="M66,104 l20,-6 l4,4 l-20,6z" fill="#C8A26B" stroke="{INK}" stroke-width="1.4"/>', person(100, 108, rot=26))
I['G17_s'] = W(ground(), box(20, 88, 22, 20), box(20, 68, 22, 20), f'<path d="M60,108 H150" stroke="{GRN}" stroke-width="3" stroke-dasharray="8 4"/>', person(104, 108))
I['G18_d'] = W(ground(), f'<rect x="54" y="62" width="36" height="12" rx="4" fill="{STEEL}"/><circle cx="92" cy="68" r="10" fill="#bbb" stroke="{INK}" stroke-width="1.5"/>', sparks(100, 64), person(126, 108, pose='carry'))
I['G18_s'] = W(ground(), f'<rect x="54" y="62" width="36" height="12" rx="4" fill="{STEEL}"/><circle cx="92" cy="68" r="10" fill="#bbb" stroke="{INK}" stroke-width="1.5"/><path d="M80,58 a14,14 0 0 1 24,6" stroke="{HAT}" stroke-width="5" fill="none"/>', person(126, 108, pose='carry'), f'<rect x="118" y="60" width="16" height="5" rx="2" fill="#2a6f97"/>')
I['G19_d'] = W(ground(), box(70, 84, 34, 24), person(56, 108, pose='bend'), f'<path d="M48,66 l4,-6 l4,6" stroke="{RED}" stroke-width="2" fill="none"/>')
I['G19_s'] = W(ground(), box(62, 70, 40, 20), person(48, 108, pose='carry'), person(118, 108, pose='carry'))
I['G20_d'] = W(ground(), sun(40, 40), person(100, 108, pose='bend'), f'<path d="M110,62 q2,6 0,8 M116,58 q2,6 0,8" stroke="{WATER}" stroke-width="2" fill="none"/>')
I['G20_s'] = W(ground(), sun(24, 30), f'<path d="M60,50 L110,40 L150,50 Z" fill="{GRN}"/><path d="M106,44 V108" stroke="{STEEL}" stroke-width="3"/>', person(84, 108), f'<rect x="120" y="86" width="10" height="22" rx="3" fill="{WATER}" stroke="{INK}" stroke-width="1.5"/>')

if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/cnbu/assets/data.js'
    s = open(p, encoding='utf-8').read()
    js = 'var ICON2=' + json.dumps(I, ensure_ascii=False) + ';\n'
    s = re.sub(r'var ICON2=\{.*?\};\n', '', s, flags=re.S)
    s = s.replace('var ICON=', js + 'var ICON=', 1)
    open(p, 'w', encoding='utf-8').write(s)
    print('icons', len(I))
