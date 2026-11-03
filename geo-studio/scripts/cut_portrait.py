"""Cut a portrait photo into cutout-puppet parts (head + hinged jaw) for engine/puppet.mjs.

Usage: python -I scripts/cut_portrait.py assets/people/trump2025.jpg assets/people/trump
Writes <out>_head.png, <out>_jaw.png and <out>.json (anchor points in the head image).

The rough outline below is hand-placed for the 2025 official portrait (1236x1600 resize);
GrabCut refines it to the real hair/skin edge. For a different photo, adjust OUTLINE and
MOUTH to that photo's coordinates.
"""
import json
import sys

import cv2
import numpy as np

OUTLINE = [
    (258, 560), (255, 470), (268, 380), (305, 285), (385, 205), (485, 158), (600, 140), (720, 148),
    (845, 188), (950, 250), (1030, 300), (1062, 335), (1040, 372), (990, 405), (975, 470), (972, 560),
    (966, 640), (962, 700), (950, 770), (915, 830), (900, 880), (860, 960), (790, 1040), (700, 1088),
    (610, 1080), (510, 1030), (430, 950), (395, 880), (352, 815), (318, 790), (296, 720), (290, 640),
]
# jaw cut line (left -> right), passes through the lips
MOUTH = [(395, 905), (520, 935), (600, 948), (690, 954), (775, 945), (870, 915), (930, 860)]


def main():
    src, out = sys.argv[1], sys.argv[2]
    img = cv2.imread(src)
    h, w = img.shape[:2]
    poly = np.array(OUTLINE, np.int32)
    rough = np.zeros((h, w), np.uint8)
    cv2.fillPoly(rough, [poly], 255)
    k = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))
    sure_fg = cv2.erode(rough, k(70))
    maybe = cv2.dilate(rough, k(36))
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    mask[maybe > 0] = cv2.GC_PR_BGD
    mask[rough > 0] = cv2.GC_PR_FGD
    mask[sure_fg > 0] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    # keep only the largest component, smooth edges for a crisp paper-cutout look
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    m = np.where(lab == big, 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k(15))
    m = cv2.GaussianBlur(m, (0, 0), 1.6)
    m = np.where(m > 127, 255, 0).astype(np.uint8)
    m = cv2.GaussianBlur(m, (0, 0), 0.8)

    # jaw region = below the mouth line
    below = np.zeros((h, w), np.uint8)
    pts = MOUTH + [(w, MOUTH[-1][1]), (w, h), (0, h), (0, MOUTH[0][1])]
    cv2.fillPoly(below, [np.array(pts, np.int32)], 255)
    below = cv2.GaussianBlur(below, (0, 0), 1.2)

    def save(alpha, name):
        rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = alpha
        ys, xs = np.where(alpha > 8)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        cv2.imwrite(f"{out}_{name}.png", rgba[y0:y1, x0:x1])
        return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

    head_a = (m.astype(np.float32) * (1 - below.astype(np.float32) / 255)).astype(np.uint8)
    jaw_a = (m.astype(np.float32) * (below.astype(np.float32) / 255)).astype(np.uint8)
    meta = {
        "source": src,
        "head": save(head_a, "head"),
        "jaw": save(jaw_a, "jaw"),
        "mouth": MOUTH,
        "mouthCenter": [690, 950],
        "chin": [700, 1085],
        "neck": [680, 1060],
        "eyes": [[525, 668], [800, 660]],
    }
    json.dump(meta, open(f"{out}.json", "w"), indent=1)
    prev = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    prev[:, :, 3] = m
    bg = np.full_like(img, (40, 170, 60))
    a = m[:, :, None].astype(np.float32) / 255
    cv2.imwrite(f"{out}_preview.jpg", (img * a + bg * (1 - a)).astype(np.uint8))
    print(meta)


if __name__ == "__main__":
    main()
