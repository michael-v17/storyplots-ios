"""
Cycle 0090 — Seedream V5 Lite reference + prompt research (trimmed).

Throwaway research script. Runs once to decide:
  (a) Which reference image format gives best face consistency across a
      scene. Trimmed to two distinct candidates: half-body white-bg vs
      multi-view turnaround. (Full-body white-bg + portrait close-up
      are skipped — half-body covers their middle ground; turnaround is
      the clear "different shape" alternative.)
  (b) Whether Seedream prefers a Danbooru-tag prompt (current refiner
      style for Animagine XL 4.0) or a natural-language cinematic
      prompt — same reference, two prompt shapes, 1 run each.

Output: 2 ref + 2 scenes + 2 prompt-comparison = 6 PNGs in
verification/0090/, plus a manifest.json. Cost ≈ $0.21 (6 × $0.035).

BYOK preservation: this script does NOT read FAL_KEY from env or any
file. It prompts for the key on stdin via getpass (won't be echoed).
The key lives only in process memory for the duration of the run.

Usage:
  cd verification/0090
  uv run --with fal-client python research.py
"""
from __future__ import annotations

import getpass
import json
import os
import time
import urllib.request
from pathlib import Path

import fal_client

OUT_DIR = Path(__file__).parent

CHARACTER = {
    "name": "Aria",
    "appearance": "young woman, long auburn hair, green eyes, freckles, slim build",
    "outfit": "fitted leather jacket, dark jeans, brown boots",
}

REFERENCE_PROMPTS = {
    "halfbody_whitebg": (
        f"{CHARACTER['appearance']}, {CHARACTER['outfit']}, "
        "half body portrait, neutral standing pose, plain white studio "
        "background, soft even lighting, looking at camera, sharp focus, "
        "photorealistic"
    ),
    "multiview_3way": (
        f"character reference sheet, {CHARACTER['appearance']}, {CHARACTER['outfit']}, "
        "three views: front, three-quarter, profile, plain white studio "
        "background, neutral pose, model sheet, photorealistic"
    ),
}

# Single representative scene — typical chat moment with natural framing.
SCENES = [
    "sitting at a coffee shop, looking out the window, soft afternoon light, melancholic expression",
]

# Slugs match the model_slug stored in provider_configs.workflow_config and
# the URLs the creator pointed at:
#   https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image
#   https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit
MODEL_BASE = "fal-ai/bytedance/seedream/v5/lite"
T2I_ENDPOINT = f"{MODEL_BASE}/text-to-image"
EDIT_ENDPOINT = f"{MODEL_BASE}/edit"


def _save(url: str, dest: Path) -> int:
    """Download an image to dest. Return bytes written."""
    urllib.request.urlretrieve(url, dest)
    return dest.stat().st_size


def _t2i(prompt: str) -> dict:
    return fal_client.subscribe(
        T2I_ENDPOINT,
        arguments={
            "prompt": prompt,
            "image_size": "portrait_4_3",
            "num_images": 1,
        },
    )


def _edit(prompt: str, image_urls: list[str]) -> dict:
    return fal_client.subscribe(
        EDIT_ENDPOINT,
        arguments={
            "prompt": prompt,
            "image_urls": image_urls,
            "image_size": "landscape_4_3",
        },
    )


def main() -> None:
    key = getpass.getpass("Paste your fal.ai API key (will not be echoed): ").strip()
    if not key:
        raise SystemExit("No key entered. Aborting.")
    os.environ["FAL_KEY"] = key

    started = time.time()
    manifest: dict = {
        "character": CHARACTER,
        "model_base": MODEL_BASE,
        "references": [],
        "scenes": [],
        "prompts_compare": [],
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    print("\n--- Step A: 4 reference variants via /text-to-image ---")
    for name, prompt in REFERENCE_PROMPTS.items():
        print(f"  ref={name} ...", flush=True)
        result = _t2i(prompt)
        url = result["images"][0]["url"]
        out = OUT_DIR / f"ref_{name}.png"
        bytes_written = _save(url, out)
        manifest["references"].append({
            "name": name,
            "prompt": prompt,
            "url": url,
            "file": out.name,
            "bytes": bytes_written,
            "seed": result.get("seed"),
        })
        print(f"    saved {out.name} ({bytes_written // 1024} KB)")

    print("\n--- Step B: per-reference 3 chat scenes via /edit ---")
    for ref in manifest["references"]:
        for i, scene in enumerate(SCENES):
            print(f"  ref={ref['name']} scene={i} ...", flush=True)
            scene_prompt = f"{CHARACTER['appearance']}, {scene}"
            result = _edit(scene_prompt, [ref["url"]])
            url = result["images"][0]["url"]
            out = OUT_DIR / f"scene_{ref['name']}_{i}.png"
            bytes_written = _save(url, out)
            manifest["scenes"].append({
                "ref_name": ref["name"],
                "scene_index": i,
                "scene": scene,
                "url": url,
                "file": out.name,
                "bytes": bytes_written,
            })
            print(f"    saved {out.name} ({bytes_written // 1024} KB)")

    print("\n--- Step C: Danbooru-tag vs natural-language prompt (1 run each) ---")
    # Anchor on halfbody_whitebg — most likely production reference shape
    # if this research validates it. 1 run per style is enough to see the
    # qualitative gap; multi-run averaging not needed for the binary
    # decision (refiner system prompt mode "seedream" yes/no).
    chosen_ref = next(r for r in manifest["references"] if r["name"] == "halfbody_whitebg")
    danbooru_prompt = (
        "1girl, solo, auburn hair, green eyes, freckles, leather jacket, jeans, "
        "brown boots, sitting, coffee shop, window, melancholy, masterpiece, high quality"
    )
    natural_prompt = (
        "A young woman with long auburn hair and green eyes, wearing a leather jacket "
        "and jeans, sits alone at a coffee shop window in the late afternoon. Soft amber "
        "light filters through the glass, catching the loose strands of her hair. Her "
        "expression is quiet, contemplative — a small melancholy in the way she watches "
        "the street outside. Cinematic, photorealistic."
    )
    for label, prompt in [("danbooru", danbooru_prompt), ("natural", natural_prompt)]:
        for i in range(1):
            print(f"  prompt={label} run={i} ...", flush=True)
            result = _edit(prompt, [chosen_ref["url"]])
            url = result["images"][0]["url"]
            out = OUT_DIR / f"compare_{label}_{i}.png"
            bytes_written = _save(url, out)
            manifest["prompts_compare"].append({
                "style": label,
                "run": i,
                "prompt": prompt,
                "url": url,
                "file": out.name,
                "bytes": bytes_written,
            })
            print(f"    saved {out.name} ({bytes_written // 1024} KB)")

    elapsed = int(time.time() - started)
    manifest["elapsed_seconds"] = elapsed
    manifest["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    total = len(manifest["references"]) + len(manifest["scenes"]) + len(manifest["prompts_compare"])
    cost = total * 0.035
    print(f"\nDone. {total} images in {elapsed}s. Approx cost ${cost:.2f}.")
    print(f"Manifest: {OUT_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
