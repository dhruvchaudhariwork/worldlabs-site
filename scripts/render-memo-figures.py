"""Render the memo's original diagrams and source-derived research charts.

Optional authoring tool, never a website build dependency. From the repo root:
  uv run --with matplotlib==3.11.2 --with fonttools==4.67.0 --with brotli==1.2.0 \
    python scripts/render-memo-figures.py

Chart values and source versions are recorded in assets/memo-figures/research-data.csv.
"""

import csv
from pathlib import Path
from tempfile import TemporaryDirectory

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Circle, FancyArrowPatch, Polygon, Rectangle
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "memo-figures"
OUT.mkdir(parents=True, exist_ok=True)
BG, INK, GRAY, LINE = "#f5f5f5", "#191919", "#626262", "#c8c8c8"
BASE, RESULT = "#b6b6b6", "#373737"
DATA = list(csv.DictReader((OUT / "research-data.csv").open()))


def canvas(width, height):
    fig = plt.figure(figsize=(width / 100, height / 100), dpi=100, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1], xlim=(0, width), ylim=(height, 0))
    ax.set_axis_off()
    return fig, ax


def text(ax, x, y, value, size=14, color=INK, align="left", **kw):
    return ax.text(x, y, value, fontsize=size * .72, color=color,
                   ha=align, va="center", linespacing=1.5, **kw)


def line(ax, points, color=LINE, width=1, dashed=False):
    ax.plot(*zip(*points), color=color, lw=width * .72,
            linestyle=(0, (4, 3)) if dashed else "-", solid_capstyle="round")


def arrow(ax, start, end, color=GRAY, dashed=False):
    ax.add_patch(FancyArrowPatch(start, end, arrowstyle="->", mutation_scale=8,
                                linewidth=.8, color=color, shrinkA=1, shrinkB=2,
                                linestyle=(0, (4, 3)) if dashed else "-"))


def node(ax, x, y, w, h, title, details, protected=False):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=BG, edgecolor=GRAY,
                          linewidth=.8, linestyle=(0, (4, 3)) if protected else "-"))
    text(ax, x + 16, y + 25, title, 17)
    text(ax, x + 16, y + 61, details, 13.5, GRAY)


def save(fig, name, title, description, mobile=False):
    stem = name + ("-mobile" if mobile else "")
    fig.savefig(OUT / (stem + ".svg"), metadata={
        "Title": title, "Description": description, "Creator": "World Labs",
        "Date": None,
    })
    if not mobile:
        fig.savefig(OUT / (stem + ".png"), dpi=200, metadata={
            "Title": title, "Description": description,
        })
    plt.close(fig)


def workstation(ax, cx, cy, mode):
    """Original isometric drawing; the same asset is carried through each stage."""
    def p(u, v, z=0):
        return cx + (u - v) * .82 - 20, cy + (u + v) * .40 - z * .84

    for n in range(-20, 121, 28):
        line(ax, [p(n, -12), p(n, 70)], "#dddddd", .6)
    for n in range(-12, 71, 20):
        line(ax, [p(-20, n), p(120, n)], "#dddddd", .6)
    top = [p(0, 0, 54), p(94, 0, 54), p(94, 45, 54), p(0, 45, 54)]
    ax.add_patch(Polygon(top, closed=True, facecolor=BG if mode == 0 else "#e3e3e3",
                         edgecolor=INK, lw=.9))
    for u, v in [(0, 0), (94, 0), (94, 45), (0, 45)]:
        line(ax, [p(u, v, 54), p(u, v)], INK, 1.2)
    if mode == 0:
        for u in [23.5, 47, 70.5]:
            line(ax, [p(u, 0, 54), p(u, 45, 54)], GRAY, .7)
        line(ax, [p(0, 22.5, 54), p(94, 22.5, 54)], GRAY, .7)
        for point in top:
            ax.add_patch(Circle(point, 2.2, facecolor=BG, edgecolor=INK, lw=.7))
    if mode == 1:
        bottom = [p(-7, -7), p(101, -7), p(101, 52), p(-7, 52)]
        upper = [p(-7, -7, 66), p(101, -7, 66), p(101, 52, 66), p(-7, 52, 66)]
        line(ax, bottom + [bottom[0]], GRAY, .8, True)
        line(ax, upper + [upper[0]], GRAY, .8, True)
        for a, b in zip(bottom, upper):
            line(ax, [a, b], GRAY, .8, True)
    if mode == 2:
        route = [p(-13, 68), p(42, 68), p(110, 68), p(110, 20)]
        line(ax, route, GRAY, 1.2, True)
        arrow(ax, route[-2], route[-1])
        for point in route[:-1]:
            ax.add_patch(Circle(point, 2.8, facecolor=BG, edgecolor=INK, lw=.8))


def workflow(mobile=False):
    width, height = (360, 660) if mobile else (640, 400)
    fig, ax = canvas(width, height)
    if mobile:
        rows = [82, 246, 410]
        for i, y in enumerate(rows):
            workstation(ax, 73, y, i)
            text(ax, 162, y - 40, ["01  Author", "02  Integrate", "03  Verify"][i], 18)
            text(ax, 162, y - 6, ["Blender / Houdini / CAD", "Game engine", "Replay + inspect"][i], 13)
            text(ax, 162, y + 43, [
                "Geometry, materials\nand procedural variants",
                "Units, asset references,\ncollisions and logic",
                "Dimensions, behavior\nand frame-time budget",
            ][i], 13.5, GRAY)
            if i < 2:
                arrow(ax, (72, y + 67), (72, rows[i + 1] - 72))
        line(ax, [(16, 518), (344, 518)])
        text(ax, 16, 546, "Shared, versioned task state", 16)
        text(ax, 16, 580, "Asset IDs · units · application versions\nNative files + interchange + checkpoints", 13.5, GRAY)
        text(ax, 16, 630, "Failed checks → revise the responsible tool", 13.5)
    else:
        centers = [106, 320, 534]
        for i, x in enumerate(centers):
            workstation(ax, x, 122, i)
            text(ax, x - 88, 213, ["01  Author", "02  Integrate", "03  Verify"][i], 18)
            text(ax, x - 88, 245, ["Blender / Houdini / CAD", "Game engine", "Replay + inspect"][i], 13.5)
            text(ax, x - 88, 281, [
                "Geometry, materials\nand procedural variants",
                "Units, asset references,\ncollisions and logic",
                "Dimensions, behavior\nand frame-time budget",
            ][i], 13.5, GRAY)
        arrow(ax, (191, 124), (225, 124))
        arrow(ax, (405, 124), (439, 124))
        line(ax, [(534, 61), (534, 22), (106, 22)])
        arrow(ax, (106, 22), (106, 61))
        text(ax, 320, 22, "Revise the responsible tool when checks fail", 12.5, GRAY,
             "center", bbox={"facecolor": BG, "edgecolor": "none", "pad": 5})
        line(ax, [(18, 328), (622, 328)])
        text(ax, 18, 353, "Shared, versioned task state", 15)
        text(ax, 18, 381, "Asset IDs · units · app versions · native files · interchange · checkpoints", 13.5, GRAY)
    save(fig, "creative-workflow", "One task across creative tools",
         "Proposed World Labs workflow. Author geometry and materials in creative tools; "
         "integrate assets, collisions and logic in a game engine; verify dimensions, behavior "
         "and frame time. Failed checks send work back to the responsible tool. Asset IDs, "
         "units, application versions and checkpoints connect the stages. The isometric "
         "workstation drawings are original schematics, not software screenshots.", mobile)


def training_loop(mobile=False):
    width, height = (360, 872) if mobile else (640, 592)
    fig, ax = canvas(width, height)
    if mobile:
        x, w = 49, 262
        node(ax, x, 20, w, 100, "Agent / current policy", "Chooses the next action\nfrom available observations")
        node(ax, x, 212, w, 100, "Engine / tool worker", "Pinned project + reset\nScenes, images, logs, artifacts")
        arrow(ax, (252, 120), (252, 212))
        text(ax, 266, 166, "Actions", 13, GRAY, "center", rotation=90)
        arrow(ax, (102, 212), (102, 120))
        text(ax, 86, 166, "Observations", 13, GRAY, "center", rotation=90)
        node(ax, x, 395, w, 100, "Protected verifier", "Structural + runtime checks\nAgent cannot edit the checks", True)
        arrow(ax, (180, 312), (180, 395))
        text(ax, 193, 354, "State + replay", 13, GRAY)
        node(ax, x, 578, w, 100, "Episode record", "Trace + artifacts + scores\nAligned by step and task version")
        arrow(ax, (180, 495), (180, 578))
        text(ax, 193, 536, "Reward + evidence", 12.5, GRAY)
        line(ax, [(49, 265), (24, 265), (24, 629)], dashed=True)
        arrow(ax, (24, 629), (49, 629), dashed=True)
        text(ax, 14, 447, "Actions + observations", 12.5, GRAY, "center", rotation=90,
             bbox={"facecolor": BG, "edgecolor": "none", "pad": 3})
        node(ax, x, 757, w, 100, "Lab’s RL trainer", "Samples scored experience\nUpdates model weights")
        arrow(ax, (180, 678), (180, 757))
        text(ax, 193, 718, "Scored rollouts", 13, GRAY)
        line(ax, [(311, 806), (344, 806), (344, 70)])
        arrow(ax, (344, 70), (311, 70))
        text(ax, 344, 450, "Updated policy for later attempts", 12.5, GRAY, "center", rotation=90,
             bbox={"facecolor": BG, "edgecolor": "none", "pad": 4})
    else:
        node(ax, 52, 66, 184, 112, "Agent / policy", "Chooses actions\nfrom observations")
        node(ax, 376, 66, 228, 112, "Engine / tool worker", "Pinned project + reset\nScenes, frames, logs")
        arrow(ax, (236, 104), (376, 104))
        text(ax, 306, 89, "Actions", 13, GRAY, "center")
        arrow(ax, (376, 151), (236, 151))
        text(ax, 306, 136, "Observations", 13, GRAY, "center")
        node(ax, 52, 286, 184, 112, "Episode record", "Trace + artifacts\n+ scores + task version")
        node(ax, 376, 286, 228, 112, "Protected verifier", "Structure + runtime checks\nAgent cannot edit checks", True)
        arrow(ax, (144, 178), (144, 286), dashed=True)
        text(ax, 156, 233, "Episode trace", 13, GRAY)
        arrow(ax, (490, 178), (490, 286))
        text(ax, 503, 233, "State +\nreplay", 13, GRAY)
        arrow(ax, (376, 346), (236, 346))
        text(ax, 306, 321, "Reward +\nevidence", 13, GRAY, "center")
        node(ax, 52, 474, 184, 102, "Lab’s RL trainer", "Samples experience\nUpdates weights")
        arrow(ax, (144, 398), (144, 474))
        text(ax, 156, 436, "Scored rollouts", 13, GRAY)
        line(ax, [(52, 525), (16, 525), (16, 121)])
        arrow(ax, (16, 121), (52, 121))
        text(ax, 16, 328, "Updated policy", 12.5, GRAY, "center", rotation=90,
             bbox={"facecolor": BG, "edgecolor": "none", "pad": 5})
        text(ax, 294, 502, "Execution produces experience.", 16)
        text(ax, 294, 544, "The trainer uses that experience\nto change the model’s weights.", 14, GRAY)
    save(fig, "training-loop", "From an attempt to a learning signal",
         "Proposed World Labs architecture. An agent sends actions to an engine or tool worker "
         "and receives observations. A protected verifier checks runtime state and replay evidence. "
         "An episode record joins action and observation traces, artifacts and reward evidence. "
         "The AI lab's RL trainer samples these records and updates the policy for future attempts. "
         "The agent cannot edit the protected checks. This is a proposed design, not an implemented product.", mobile)


def chart_rows(ax, width, groups, top, gap, axis_y, paired=False):
    left, right = 18, width - 56
    scale = (right - left) / 100
    # Fixed 0–100 scales; never truncate bars to exaggerate the reported gains.
    for value in range(0, 101, 25):
        x = left + value * scale
        line(ax, [(x, top + 16), (x, axis_y - 18)], "#dedede", .7)
        text(ax, x, axis_y, str(value), 12, GRAY, "center")
    for i, group in enumerate(groups):
        y = top + i * gap
        text(ax, left, y, group["label"], 14, INK,
             bbox={"facecolor": BG, "edgecolor": "none", "pad": 2})
        if paired:
            text(ax, width - 13, y, group["delta"], 13, GRAY, "right",
                 bbox={"facecolor": BG, "edgecolor": "none", "pad": 2})
        for j, row in enumerate(group["rows"]):
            yy = y + 21 + j * 23
            value = float(row["score_percent"])
            color = BASE if row["condition"] in ["No screenshot or video", "Base model"] else RESULT
            ax.add_patch(Rectangle((left, yy), value * scale, 14, color=color, lw=0))
            sd = row["standard_deviation_pp"]
            if sd:
                ax.errorbar(left + value * scale, yy + 7, xerr=float(sd) * scale,
                            fmt="none", ecolor=INK, elinewidth=.8, capsize=3, capthick=.8)
            text(ax, left + value * scale + 7, yy + 7, f"{value:.1f}", 13)


def feedback_chart(mobile=False):
    width, height = (360, 300) if mobile else (640, 280)
    fig, ax = canvas(width, height)
    text(ax, 16, 22, "A. Visual feedback during a task", 17)
    text(ax, 16, 50, "GPT-5.4 · GameDevBench · pass@1 (%)", 13.5, GRAY)
    if mobile:
        text(ax, 16, 79, "+10.9 percentage points", 14)
    else:
        text(ax, 623, 50, "+10.9 percentage points", 14, INK, "right")
    rows = [r for r in DATA if r["study"] == "GameDevBench"]
    groups = [{"label": "No screenshot or video", "rows": [rows[0]]},
              {"label": "Screenshot + runtime video", "rows": [rows[1]]}]
    chart_rows(ax, width, groups, 115 if mobile else 95, 76, height - 26)
    save(fig, "research-feedback", "Visual feedback during a task: GameDevBench",
         "Redrawn from Chi et al., GameDevBench, arXiv 2602.11103v2, Table 2. "
         "GPT-5.4 in the Codex harness: pass@1 rises from 41.1% without screenshot or video "
         "to 52.0% with screenshot and runtime-video tools, a 10.9 percentage-point increase. "
         "This changes observations during inference, not model training; inference costs differ. "
         "The axis runs from 0 to 100 percent. No uncertainty interval is reported for these rows.", mobile)


def transfer_chart(mobile=False):
    width, height = (360, 466) if mobile else (640, 466)
    fig, ax = canvas(width, height)
    text(ax, 16, 22, "B. Reasoning after game-based RL", 17)
    text(ax, 16, 50, "Qwen2.5-VL-7B · accuracy (%)", 13.5, GRAY)
    ax.add_patch(Rectangle((17, 73), 12, 12, color=BASE, lw=0))
    text(ax, 36, 79, "Base model", 13)
    ax.add_patch(Rectangle((145, 73), 12, 12, color=RESULT, lw=0))
    text(ax, 164, 79, "After Snake + Rotation RL", 13)
    groups = []
    for benchmark in ["MathVista", "MathVerse", "MathVision"]:
        rows = [r for r in DATA if r["benchmark"] == benchmark]
        delta = float(rows[1]["score_percent"]) - float(rows[0]["score_percent"])
        groups.append({"label": benchmark, "rows": rows, "delta": f"+{delta:.1f} pp"})
    chart_rows(ax, width, groups, 124, 100, 416, True)
    text(ax, 17, 444 if mobile else 440, "pp = percentage points", 12, GRAY)
    save(fig, "research-transfer", "Reasoning after game-based RL: Play to Generalize",
         "Redrawn from Xie et al., Play to Generalize, arXiv 2506.08011v4, Table 2. "
         "Qwen2.5-VL-7B before and after ViGaL Snake plus Rotation RL: "
         "MathVista 68.0% to 71.9%; MathVerse 49.0% to 52.4%; MathVision 26.0% to 27.5%. "
         "After-RL error bars are the reported standard deviations over three runs: "
         "0.4, 0.2 and 0.3 percentage points respectively. Baseline variability is not reported. "
         "All three benchmarks use a 0–100 percent axis. This is a selected math evaluation, "
         "not evidence of transfer to game engines or physical systems.", mobile)


with TemporaryDirectory() as font_dir:
    font = TTFont(ROOT / "assets/fonts/geist-regular.woff2")
    font.flavor = None
    ttf_path = Path(font_dir) / "Geist-Regular.ttf"
    font.save(ttf_path)
    font_manager.fontManager.addfont(ttf_path)
    matplotlib.rcParams.update({
        "font.family": font_manager.FontProperties(fname=ttf_path).get_name(),
        "svg.fonttype": "path", "svg.hashsalt": "worldlabs-memo-figures-v1",
    })
    for draw in [workflow, training_loop, feedback_chart, transfer_chart]:
        draw()
        draw(mobile=True)
